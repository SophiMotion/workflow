"""Strong references for Fusion event handlers. / 保存事件处理器强引用。"""

from typing import Any, List


HANDLERS: List[Any] = []


def keep(handler: Any) -> Any:
    HANDLERS.append(handler)
    return handler


def clear() -> None:
    HANDLERS.clear()
