"""Bounded, cancellable consultation jobs. Evidence and answers persist locally."""
import copy
import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib.request import getproxies
from feishu.ai_config import AIConfig, KEYS
from feishu.storage import read_json, safe_path, write_json


def model_environment(values, root):
    env = {k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','LANG','SSL_CERT_FILE')}
    env.update({key:values[key] for key in KEYS})
    env['DSH_HOME'] = str(Path(root) / '.state/harness')
    # Python reads macOS system proxies; Node fetch needs an explicit opt-in.
    proxies = getproxies()
    for name in ('http', 'https'):
        if proxies.get(name, '').startswith(('http://','https://')):
            env[name.upper() + '_PROXY'] = proxies[name]
    if 'HTTP_PROXY' in env or 'HTTPS_PROXY' in env:
        env['NODE_USE_ENV_PROXY'] = '1'
        env['NO_PROXY'] = proxies.get('no', 'localhost,127.0.0.1')
    return env


class Consultations:
    def __init__(self, root, project, knowledge, documents, config=None):
        self.root, self.knowledge, self.documents = Path(root), knowledge, documents
        self.config = config or AIConfig(project)
        self.file = safe_path(self.root, '.state/consultations.json')
        self.lock = threading.RLock()
        self.jobs = read_json(self.file, [])[:20]
        self.process = None
        self.active = None
        for job in self.jobs:
            if job['status'] == 'running':
                job.update(status='interrupted', message='后台已重启，未完成的回答已中止。可重新提交问题。')
        if self.jobs:
            self._save()

    def _save(self):
        write_json(self.file, self.jobs)

    def history(self):
        with self.lock:
            return {'jobs': [{k: job.get(k) for k in ('id', 'question', 'created_at', 'status')} for job in self.jobs]}

    def get(self, identifier):
        with self.lock:
            for job in self.jobs:
                if job['id'] == identifier:
                    return copy.deepcopy(job)
        raise ValueError('问答记录不存在')

    def start(self, body):
        question = body.get('question', '')
        scope = body.get('spaces', [])
        if not isinstance(question, str) or not 3 <= len(question.strip()) <= 2000:
            raise ValueError('请输入 3–2000 字的问题，包含项目名称或关键主题')
        if not isinstance(scope, list) or len(scope) > 200 or any(not isinstance(s, str) or len(s) > 40 for s in scope):
            raise ValueError('知识库范围格式错误')
        with self.lock:
            if self.active:
                raise ValueError('已有问答正在进行，请等待完成或取消')
            job = {'id': uuid.uuid4().hex, 'question': question.strip(), 'spaces': scope,
                   'created_at': time.time(), 'status':'running', 'stage':'retrieval',
                   'sources':[], 'answers':{}, 'stages':{}, 'message':'正在检索本地知识库'}
            self.jobs = [job, *self.jobs][:20]
            self.active = job['id']
            self._save()
            threading.Thread(target=self._run, args=(job,), daemon=True, name='knowledge-qa').start()
            return copy.deepcopy(job)

    def _event(self, job, event):
        with self.lock:
            if job['status'] != 'running':
                return
            # Persist only the documented protocol, never raw provider logs/reasoning.
            if event.get('type') == 'stage':
                job['stage'] = event['stage']
                job['stages'][event['stage']] = event['status']
                job['message'] = '两路模型正在独立分析' if event['stage'] != 'synthesis' else 'DeepSeek 正在综合两路分析'
            elif event.get('type') == 'answer':
                answer = event['answer']
                if answer.get('error'):
                    answer['error'] = self.config.redact(answer['error'])
                    if 'insufficient balance' in answer['error'].lower():
                        answer['error'] = 'DeepSeek API 余额不足。请补充该账户余额后重新提交问题。'
                job['answers'][event['stage']] = answer
                job['stages'][event['stage']] = 'failed' if answer.get('error') else 'completed'
            elif event.get('type') == 'result':
                job['status'] = event.get('status', 'failed')
                job['message'] = self.config.redact(event.get('message') or '回答已完成，引用编号可打开原文。')
            self._save()

    def _run(self, job):
        process, timer = None, None
        try:
            sources = self.knowledge.search(self.documents(), job['question'], job['spaces'])
            with self.lock:
                if job['status'] != 'running':
                    return
                job['sources'] = sources
                if not sources:
                    job.update(status='needs_context', message='未检索到相关正文。请补充项目名称或关键术语，或切换知识库范围；此次未调用模型。')
                    self._save()
                    return
                self._save()
            values = self.config.ready()
            node = shutil.which('node') or str(Path.home() / '.local/bin/node')
            if not Path(node).is_file() or not (self.root / 'node_modules/@deepseek-ai/dsh-llm').is_dir():
                raise ValueError('缺少 Node.js 或 Harness 依赖，请在 feishu 目录运行 npm ci --ignore-scripts')
            job['models'] = {'openai':values['OPENAI_MODEL'], 'deepseek':values['DEEPSEEK_MODEL']}
            env = model_environment(values, self.root)
            with self.lock:
                if job['status'] != 'running':
                    return
                process = subprocess.Popen([node, str(self.root / 'harness.mjs')], stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8', env=env, cwd=self.root)
                self.process = process
            timer = threading.Timer(390, process.kill)
            timer.daemon = True
            timer.start()
            process.stdin.write(json.dumps({'question':job['question'],'sources':sources,'models':job['models']}, ensure_ascii=False))
            process.stdin.close()
            for line in process.stdout:
                if len(line) > 200000:
                    raise ValueError('模型响应超过本地处理上限')
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(event, dict):
                    self._event(job, event)
            process.wait(timeout=5)
            if job['status'] == 'running':
                raise ValueError('模型进程已中断或超时，已保留完成的回答。')
        except Exception as error:
            with self.lock:
                if job['status'] == 'running':
                    job.update(status='failed', message=self.config.redact(str(error)))
        finally:
            if timer:
                timer.cancel()
            if process:
                if process.poll() is None:
                    process.kill()
                process.wait()
                process.stdout.close()
            with self.lock:
                job['finished_at'] = time.time()
                self.active, self.process = None, None
                self._save()

    def cancel(self, identifier):
        with self.lock:
            if self.active != identifier:
                raise ValueError('该问答没有在运行')
            job = next(job for job in self.jobs if job['id'] == identifier)
            job.update(status='cancelled', message='已取消。已完成的回答与引用保留；已经发生的 API 用量仍由供应商计费。')
            if self.process and self.process.poll() is None:
                self.process.kill()
            self._save()
            return copy.deepcopy(job)

    def close(self):
        with self.lock:
            if self.active:
                self.cancel(self.active)
