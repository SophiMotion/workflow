// 界面语言独立于刻字内容 / Interface locale is independent of engraving text.
export const LANGUAGES = { zh: '中文', en: 'English', fr: 'Français', ja: '日本語' };
export const MESSAGES = {
  "内部直壁段": ["Upper straight section", "Section intérieure droite", "内側の直壁部分"],
  "镜像凹纹 · Ø30 螺纹座 · M20 × 2.5 盲孔": ["Mirrored recess · Ø30 boss · M20 × 2.5 blind hole", "Creux en miroir · Bossage Ø30 · Trou borgne M20 × 2,5", "反転した凹模様・Ø30 ねじ座・M20 × 2.5 止まり穴"],
  "套筒总高为月饼厚度加 12 mm：内部直壁段 6 mm，腔底 6 mm。Ø30 螺纹座穿过导向孔；M20 盲孔深 16 mm。": ["Total sleeve height is cake thickness + 12 mm: 6 mm upper straight section and 6 mm base. The Ø30 boss passes through the guide hole; the M20 blind hole is 16 mm deep.", "Hauteur totale : épaisseur du gâteau + 12 mm, soit 6 mm de section droite et 6 mm de fond. Le bossage Ø30 traverse le guidage ; le trou borgne M20 fait 16 mm de profondeur.", "外筒の全高は月餅の厚さ + 12 mm：内側の直壁部分 6 mm、底板 6 mm。Ø30 のねじ座はガイド穴を通り、M20 穴の深さは 16 mm です。"],
  "压片厚度不能超过 6 mm 内部直壁段，请将压片厚度调至 4–6 mm。": ["The stamp must fit the 6 mm straight section. Set its thickness to 4–6 mm.", "Le tampon doit tenir dans la section droite de 6 mm. Réglez son épaisseur entre 4 et 6 mm.", "押し型の厚さは 6 mm の直壁部分に収まる必要があります。4〜6 mm に調整してください。"],
  "文字面内腔不足以容纳直径 30 mm 螺纹座，请增大月饼直径或减小斜度。": ["The top cavity is too small for the Ø30 mm boss. Increase the cake diameter or reduce the draft angle.", "La cavité supérieure est trop petite pour le bossage Ø30 mm. Augmentez le diamètre ou réduisez la dépouille.", "上部の内腔に Ø30 mm のねじ座が入りません。月餅の直径を大きくするか、抜き勾配を小さくしてください。"],
  "成形腔高度": ["Cake cavity height", "Hauteur de cavité", "成形室の高さ"],
  "腔底厚度": ["Cavity base thickness", "Épaisseur du fond", "底板の厚さ"],
  "镜像凹纹 · Ø40 螺纹座 · M20 × 2.5 盲孔": ["Mirrored recess · Ø40 boss · M20 × 2.5 blind hole", "Creux en miroir · Bossage Ø40 · Trou borgne M20 × 2,5", "反転した凹模様・Ø40 ねじ座・M20 × 2.5 止まり穴"],
  "光杆 Ø30 × 40 mm · 螺纹段 M20 × 15 mm · 手柄 Ø40 mm": ["Shaft Ø30 × 40 mm · M20 stud, 15 mm long · Handle Ø40 mm", "Tige Ø30 × 40 mm · Goujon M20, longueur 15 mm · Poignée Ø40 mm", "軸 Ø30 × 40 mm・M20 ねじ部長さ 15 mm・ハンドル Ø40 mm"],
  "腔底固定 6 mm；套筒高度随月饼和压片变化，另留螺纹座空间。M20 × 2.5 盲孔深 16 mm，配合 15 mm 螺柱。": ["The cavity base is 6 mm thick. Sleeve height follows the cake and stamp, with space for the boss. The M20 × 2.5 blind hole is 16 mm deep for the 15 mm stud.", "Fond de 6 mm. La hauteur du fourreau suit celle du gâteau et du tampon, avec un espace pour le bossage. Trou borgne M20 × 2,5 de 16 mm pour le goujon de 15 mm.", "底板は 6 mm。外筒の高さは月餅と押し型に合わせ、ねじ座の空間を確保します。M20 × 2.5 の穴深さは 16 mm、ねじ部長さは 15 mm です。"],
  "40 mm 杆长可完整脱模的月饼厚度上限为 33 mm。": ["The 40 mm shaft supports full ejection for cakes up to 33 mm thick.", "La tige de 40 mm permet une éjection complète jusqu’à 33 mm d’épaisseur.", "長さ 40 mm の軸で完全に押し出せる月餅の厚さは最大 33 mm です。"],
  "文字面内腔不足以容纳直径 40 mm 螺纹座，请增大月饼直径或减小斜度。": ["The top cavity is too small for the Ø40 mm boss. Increase the cake diameter or reduce the draft angle.", "La cavité supérieure est trop petite pour le bossage Ø40 mm. Augmentez le diamètre ou réduisez la dépouille.", "上部の内腔に Ø40 mm のねじ座が入りません。月餅の直径を大きくするか、抜き勾配を小さくしてください。"],
  "脱模斜度": ["Draft angle", "Angle de dépouille", "抜き勾配"],
  "底面": ["Base", "Base", "底面"],
  "文字面": ["Text face", "Face du texte", "文字の面"],
  "请选择 Mooncake 导出的毫米制设计 JSON（v1 / v2）。": ["Choose a Mooncake design JSON in millimeters (v1 / v2).", "Choisissez un JSON Mooncake en millimètres (v1 / v2).", "Mooncake の mm 単位のデザイン JSON（v1 / v2）を選択してください。"],
  "界面语言": [
    "Language",
    "Langue",
    "表示言語"
  ],
  "Mooncake 首页": [
    "Mooncake home",
    "Accueil Mooncake",
    "Mooncake ホーム"
  ],
  "主导航": [
    "Main navigation",
    "Navigation principale",
    "メインナビゲーション"
  ],
  "设计工坊": [
    "Design studio",
    "Atelier",
    "デザイン工房"
  ],
  "制作指南": [
    "Guide",
    "Guide",
    "作り方"
  ],
  "管理员": [
    "Admin",
    "Admin",
    "管理者"
  ],
  "把心意，刻进团圆": [
    "Made to mean more",
    "Un cadeau qui vous ressemble",
    "想いを刻む、特別な月餅"
  ],
  "一枚月饼，一份独一无二的心意。": [
    "A little mooncake, a personal touch.",
    "Une petite douceur, une attention unique.",
    "あなただけの月餅に、大切な想いを。"
  ],
  "你的设计，所见即所得": [
    "Your design, brought to life",
    "Votre création prend forme",
    "デザインを、そのまま形に"
  ],
  "已在本机自动保存": [
    "Saved on this device",
    "Enregistré sur cet appareil",
    "この端末に自動保存済み"
  ],
  "本机存储不可用，请导出保存": [
    "Export to save your design",
    "Exportez pour sauvegarder",
    "保存できません。書き出してください"
  ],
  "调整参数": [
    "Make it yours",
    "Personnalisez",
    "カスタマイズ"
  ],
  "选择尺寸、花纹与文字": [
    "Size, pattern & lettering",
    "Taille, motif et texte",
    "サイズ・模様・文字を選ぶ"
  ],
  "实时预览": [
    "See it in 3D",
    "Aperçu en 3D",
    "3D プレビュー"
  ],
  "3D 模型即时呈现": [
    "Watch your design take shape",
    "Le modèle évolue en direct",
    "変更をすぐに反映"
  ],
  "完成下单": [
    "Save your order",
    "Votre commande",
    "注文を準備"
  ],
  "保存清单，与商家确认": [
    "Save & confirm with the maker",
    "À confirmer avec le fabricant",
    "保存して販売者に確認"
  ],
  "完成设计 · 去购买": [
    "Finish design · Buy",
    "Terminer · Acheter",
    "デザイン完成・購入へ"
  ],
  "按需定制 · 心意专属": [
    "Made to order, made for you",
    "Sur mesure, rien que pour vous",
    "想いに合わせるオーダーメイド"
  ],
  "团圆有形，心意无价。": [
    "Small mooncakes. Lasting memories.",
    "Un petit cadeau, un grand souvenir.",
    "想いを形に、笑顔をひとつに。"
  ],
  "重新设计": [
    "Start again",
    "Recommencer",
    "最初から作る"
  ],
  "开始一份新设计": [
    "Start a new design",
    "Créer un nouveau modèle",
    "新しいデザインを始める"
  ],
  "当前设计将恢复默认。需要保留的话，可以先在管理员工具中导出。": [
    "This resets your design. Export it from the admin tools first if you want to keep it.",
    "Le modèle sera réinitialisé. Pour le conserver, exportez-le d’abord dans les outils admin.",
    "デザインを初期状態に戻します。残したい場合は、先に管理ツールから書き出してください。"
  ],
  "保留当前设计": [
    "Keep this design",
    "Conserver ce modèle",
    "今のデザインを残す"
  ],
  "定制你的月饼": [
    "Your mooncake",
    "Votre mooncake",
    "月餅をデザイン"
  ],
  "由你定义": [
    "Made by you",
    "À votre image",
    "あなたらしく"
  ],
  "定制步骤": [
    "Design steps",
    "Étapes de création",
    "デザインの手順"
  ],
  "尺寸": [
    "Size",
    "Taille",
    "サイズ"
  ],
  "正面": [
    "Front",
    "Face",
    "正面"
  ],
  "文字": [
    "Text",
    "Texte",
    "文字"
  ],
  "直径": [
    "Diameter",
    "Diamètre",
    "直径"
  ],
  "厚度": [
    "Thickness",
    "Épaisseur",
    "厚さ"
  ],
  "周边花纹": [
    "Edge pattern",
    "Contour",
    "側面の模様"
  ],
  "经典花边": [
    "Scalloped",
    "Festonné",
    "花びら"
  ],
  "柔和波纹": [
    "Soft waves",
    "Ondulations",
    "波形"
  ],
  "简约圆形": [
    "Smooth circle",
    "Cercle lisse",
    "円形"
  ],
  "花边数量": [
    "Edge repeats",
    "Nombre de lobes",
    "側面の山数"
  ],
  "瓣": [
    "lobes",
    "lobes",
    "山"
  ],
  "从大小到轮廓，让每一处都刚刚好。": [
    "Find your perfect size and silhouette.",
    "Trouvez la taille et le contour qui vous plaisent.",
    "サイズも輪郭も、お好みに合わせて。"
  ],
  "参数化花纹": [
    "Pattern library",
    "Motifs",
    "模様を選ぶ"
  ],
  "参考图案": [
    "Your image",
    "Votre image",
    "画像から作る"
  ],
  "精选花纹 · 10 款": [
    "10 curated patterns",
    "10 motifs choisis",
    "厳選した 10 種の模様"
  ],
  "向下滚动，挑选心意": [
    "Scroll to explore",
    "Faites défiler",
    "スクロールして選ぶ"
  ],
  "十款正面花纹": [
    "Ten front patterns",
    "Dix motifs de face",
    "10 種の正面模様"
  ],
  "灵感参考 ↗": [
    "Inspiration ↗",
    "Inspiration ↗",
    "参考デザイン ↗"
  ],
  "花纹数量": [
    "Pattern repeats",
    "Répétitions",
    "模様の数"
  ],
  "花纹直径": [
    "Pattern diameter",
    "Diamètre du motif",
    "模様の直径"
  ],
  "浮雕高度": [
    "Relief height",
    "Hauteur du relief",
    "浮き彫りの高さ"
  ],
  "上传参考图案": [
    "Upload an image",
    "Importer une image",
    "画像を読み込む"
  ],
  "已上传的参考图案": [
    "Uploaded image",
    "Image importée",
    "読み込み済みの画像"
  ],
  "点击替换图案": [
    "Click to replace",
    "Cliquez pour remplacer",
    "クリックで画像を変更"
  ],
  "正在生成浮雕…": [
    "Creating relief…",
    "Création du relief…",
    "浮き彫りを生成中…"
  ],
  "上传你的专属图案": [
    "Upload your own image",
    "Importez votre motif",
    "オリジナルの画像を追加"
  ],
  "PNG / JPG / WebP · 最大 10 MB": [
    "PNG / JPG / WebP · Up to 10 MB",
    "PNG / JPG / WebP · 10 Mo max.",
    "PNG / JPG / WebP・最大 10 MB"
  ],
  "反转深浅": [
    "Invert light & dark",
    "Inverser les tons",
    "明暗を反転"
  ],
  "深色部分凸起，建议使用简洁的黑白图案。图案会适配圆形区域，并为文字留白。": [
    "Dark areas are raised. Use a simple black-and-white image; it fits the circle with space for your text.",
    "Les zones sombres sont en relief. Choisissez un motif noir et blanc simple : il s’adapte au cercle en réservant la place du texte.",
    "暗い部分が浮き上がります。シンプルな白黒画像がおすすめです。円形に合わせ、中央の文字用スペースを確保します。"
  ],
  "图片在本机转换为三层浮雕，无需上传。": [
    "Your image becomes a three-level relief on this device.",
    "L’image est convertie en trois niveaux de relief sur cet appareil.",
    "画像はこの端末で 3 段階の浮き彫りに変換されます。"
  ],
  "细节有层次，心意有温度。": [
    "Thoughtful details, a personal touch.",
    "Des détails délicats, une attention unique.",
    "細やかな模様に、あたたかな想いを。"
  ],
  "把心意，刻在中间": [
    "A message at the heart",
    "Un message au cœur",
    "中央に想いを刻む"
  ],
  "内部文字": [
    "Inner text",
    "Texte central",
    "中央の文字"
  ],
  "刻下你的祝福": [
    "Make your mark",
    "Gravez votre message",
    "願いを文字に"
  ],
  "最多 2 个汉字或 5 个英文字母，也可留空。": [
    "Up to 2 Chinese characters or 5 English letters. Blank is fine.",
    "2 caractères chinois ou 5 lettres anglaises maximum. Facultatif.",
    "漢字は 2 文字、英字は 5 文字まで。空欄も可能です。"
  ],
  "请输入最多 2 个汉字或 5 个英文字母，请勿混用。": [
    "Use up to 2 Chinese characters or 5 English letters, without mixing them.",
    "Saisissez au plus 2 caractères chinois ou 5 lettres anglaises, sans les mélanger.",
    "漢字 2 文字以内、または英字 5 文字以内で入力してください。混在はできません。"
  ],
  "字体风格": [
    "Typeface",
    "Police",
    "書体"
  ],
  "雅致宋体": [
    "Elegant serif",
    "Sérif élégant",
    "上品な明朝体"
  ],
  "简洁黑体": [
    "Clean sans",
    "Sans sérif",
    "すっきりしたゴシック体"
  ],
  "文字排列": [
    "Text layout",
    "Disposition",
    "文字の配置"
  ],
  "居中直排": [
    "Centered",
    "Centré",
    "中央に横書き"
  ],
  "环形排列": [
    "Circular",
    "Circulaire",
    "円弧に沿う"
  ],
  "沿内圈环绕，文字自动适配可用空间。": [
    "Letters follow the inner circle and resize to fit.",
    "Les lettres suivent le cercle intérieur et s’ajustent à l’espace.",
    "内側の円に沿って配置し、収まるサイズに調整します。"
  ],
  "文字大小": [
    "Text size",
    "Taille du texte",
    "文字サイズ"
  ],
  "不添加文字": [
    "No lettering",
    "Sans texte",
    "文字を入れない"
  ],
  "字形会随设计一起保存，留住你的原意。": [
    "Lettering scales to fit and is saved with your design.",
    "Le texte s’ajuste au cercle et est enregistré avec votre création.",
    "文字は内側に収まるよう調整され、形状も一緒に保存されます。"
  ],
  "下一步 ·": [
    "Next ·",
    "Suivant ·",
    "次へ・"
  ],
  "挑选正面花纹": [
    "Choose a pattern",
    "Choisir un motif",
    "正面の模様を選ぶ"
  ],
  "写下祝福": [
    "Add your message",
    "Ajouter un message",
    "文字を入れる"
  ],
  "花好月圆": [
    "Bloom",
    "Floraison",
    "花咲く満月"
  ],
  "莲珠团花": [
    "Lotus & beads",
    "Lotus et perles",
    "蓮と珠"
  ],
  "重瓣莲华": [
    "Layered lotus",
    "Lotus double",
    "八重の蓮"
  ],
  "繁花簇锦": [
    "Blossom wreath",
    "Couronne fleurie",
    "花の輪"
  ],
  "菱锦团圆": [
    "Diamond weave",
    "Losanges tissés",
    "菱形の錦"
  ],
  "八芒锦星": [
    "Eight-point stars",
    "Étoiles à huit branches",
    "八角の星"
  ],
  "折扇流光": [
    "Folding fans",
    "Éventails",
    "扇の光"
  ],
  "弦月花环": [
    "Crescent wreath",
    "Couronne de lunes",
    "三日月の輪"
  ],
  "星月相映": [
    "Radiance",
    "Rayonnement",
    "月のきらめき"
  ],
  "涟漪团圆": [
    "Ripples",
    "Ondes",
    "さざ波"
  ],
  "舒展花瓣，经典留白": [
    "Open petals, room to breathe",
    "Des pétales ouverts, tout en légèreté",
    "広がる花びらと、ゆったりした余白"
  ],
  "尖瓣镂线，珠点相衬": [
    "Delicate petals with pearl accents",
    "Pétales ajourés et petites perles",
    "透かしの花びらに珠を添えて"
  ],
  "双层错瓣，细腻层次": [
    "Two layers of alternating petals",
    "Deux rangées de pétales décalés",
    "花びらを重ねた繊細な立体感"
  ],
  "五瓣小花，围合成环": [
    "A ring of five-petal flowers",
    "Une ronde de fleurs à cinq pétales",
    "五つの花びらがつくる輪"
  ],
  "几何织锦，错落有序": [
    "A rhythmic geometric weave",
    "Un tissage géométrique rythmé",
    "規則正しく並ぶ幾何学模様"
  ],
  "星形锦纹，节奏分明": [
    "Bold stars in a balanced rhythm",
    "Des étoiles au rythme régulier",
    "星を連ねたリズミカルな模様"
  ],
  "三重弧线，轻盈展开": [
    "Three airy, sweeping arcs",
    "Trois arcs légers et déployés",
    "軽やかに広がる三重の弧"
  ],
  "弯月连缀，点点星光": [
    "Crescents joined by little stars",
    "Des croissants parsemés d’étoiles",
    "三日月に小さな星を添えて"
  ],
  "放射菱瓣，简洁利落": [
    "Crisp, radiating diamond petals",
    "Des losanges rayonnants et épurés",
    "すっきりと放射状に広がる菱形"
  ],
  "柔和起伏，层层圆满": [
    "Soft waves, concentric circles",
    "Des vagues douces et concentriques",
    "やわらかな波が重なる輪"
  ],
  "月饼 3D 预览": [
    "Mooncake 3D preview",
    "Aperçu 3D du mooncake",
    "月餅の 3D プレビュー"
  ],
  "实时 3D 预览": [
    "Live 3D preview",
    "Aperçu 3D en direct",
    "リアルタイム 3D"
  ],
  "重置视角": [
    "Reset view",
    "Réinitialiser la vue",
    "視点をリセット"
  ],
  "拖动旋转 · 滚轮缩放": [
    "Drag to rotate · Scroll to zoom",
    "Glisser pour tourner · Défiler pour zoomer",
    "ドラッグで回転・スクロールで拡大"
  ],
  "立体": [
    "3D",
    "3D",
    "立体"
  ],
  "放大预览": [
    "Zoom in",
    "Agrandir",
    "拡大"
  ],
  "缩小预览": [
    "Zoom out",
    "Réduire",
    "縮小"
  ],
  "关闭弹窗": [
    "Close dialog",
    "Fermer",
    "閉じる"
  ],
  "心意已保存": [
    "Your design is saved",
    "Votre création est enregistrée",
    "デザインを保存しました"
  ],
  "确认你的专属定制": [
    "Your custom order",
    "Votre commande sur mesure",
    "オーダー内容を確認"
  ],
  "定制订单已下载到本机，请交给商家确认价格与制作。": [
    "Your order file is downloaded. Share it with the maker to confirm pricing and production.",
    "Votre fichier de commande est téléchargé. Transmettez-le au fabricant pour confirmer le prix et la fabrication.",
    "注文ファイルを保存しました。販売者に渡して価格と製作内容をご確認ください。"
  ],
  "核对设计，保存一份属于你的定制清单。": [
    "Review your design and save your custom order file.",
    "Vérifiez votre création et enregistrez votre commande.",
    "デザインを確認して、オーダー内容を保存します。"
  ],
  "专属月饼 ·": [
    "Custom mooncake ·",
    "Mooncake personnalisé ·",
    "オリジナル月餅・"
  ],
  "无字款": [
    "No text",
    "Sans texte",
    "文字なし"
  ],
  "专属图片浮雕": [
    "Custom image relief",
    "Relief personnalisé",
    "画像の浮き彫り"
  ],
  "浮雕": [
    "Relief",
    "Relief",
    "浮き彫り"
  ],
  "定制数量": [
    "Quantity",
    "Quantité",
    "数量"
  ],
  "减少数量": [
    "Decrease quantity",
    "Diminuer la quantité",
    "数量を減らす"
  ],
  "增加数量": [
    "Increase quantity",
    "Augmenter la quantité",
    "数量を増やす"
  ],
  "给商家的备注": [
    "Note to the maker",
    "Note au fabricant",
    "販売者へのメモ"
  ],
  "（选填）": [
    "(optional)",
    "(facultatif)",
    "（任意）"
  ],
  "写下你的包装、数量或制作需求…": [
    "Packaging or production requests…",
    "Vos demandes d’emballage ou de fabrication…",
    "包装や製作についてのご希望…"
  ],
  "订单状态": [
    "Order status",
    "État de la commande",
    "注文状況"
  ],
  "待商家确认 · 未付款": [
    "Awaiting confirmation · Unpaid",
    "À confirmer · Non payé",
    "販売者の確認待ち・未払い"
  ],
  "此页面尚未连接商城。保存清单不会提交订单或扣款，最终价格与交付时间由商家确认。": [
    "This page is not connected to a store. Saving a file does not place an order or take payment. Confirm price and delivery with the maker.",
    "Cette page n’est pas reliée à une boutique. Enregistrer le fichier ne passe aucune commande et n’entraîne aucun paiement. Le fabricant confirmera le prix et le délai.",
    "ショップには未接続です。ファイルを保存しても注文や決済は行われません。価格と納期は販売者にご確認ください。"
  ],
  "再次下载定制订单": [
    "Download again",
    "Télécharger à nouveau",
    "もう一度ダウンロード"
  ],
  "保存定制订单": [
    "Save order file",
    "Enregistrer la commande",
    "注文ファイルを保存"
  ],
  "设计文件管理": [
    "Design files",
    "Fichiers de création",
    "デザインファイル管理"
  ],
  "将你的设计带到 Fusion 360，继续完成制作。": [
    "Bring your design into Fusion 360 for production.",
    "Transférez votre création dans Fusion 360 pour la fabrication.",
    "デザインを Fusion 360 に読み込み、製作へ進みます。"
  ],
  "导出设计 JSON": [
    "Export design JSON",
    "Exporter le JSON",
    "デザイン JSON を書き出す"
  ],
  "包含尺寸、花纹、文字与实体轮廓": [
    "Dimensions, patterns, text and solid outlines",
    "Dimensions, motifs, texte et contours solides",
    "寸法・模様・文字・立体輪郭を保存"
  ],
  "导入已有设计": [
    "Import a design",
    "Importer un modèle",
    "既存のデザインを読み込む"
  ],
  "恢复参数，继续调整你的设计": [
    "Restore your settings and keep designing",
    "Retrouvez vos réglages pour continuer",
    "設定を復元して編集を続ける"
  ],
  "正在创建实体…": [
    "Creating solids…",
    "Création des solides…",
    "ソリッドを作成中…"
  ],
  "导入 Fusion": [
    "Import into Fusion",
    "Importer dans Fusion",
    "Fusion に読み込む"
  ],
  "打开本机插件，生成月饼与对应模具": [
    "Open the local add-in to create the cake and mold",
    "Ouvrir le module local pour créer le mooncake et son moule",
    "ローカルのアドインで月餅と型を生成"
  ],
  "导入设计文件": [
    "Import design file",
    "Importer un fichier",
    "デザインファイルを選択"
  ],
  "F3D 已保存到": [
    "F3D saved to",
    "F3D enregistré dans",
    "F3D の保存先"
  ],
  "已连接插件": [
    "Connected add-in",
    "Module connecté",
    "接続済みアドイン"
  ],
  "本机插件：mooncake/mooncake.py · 与 Mooncake.html 同目录": [
    "Local add-in: mooncake/mooncake.py · Beside Mooncake.html",
    "Module local : mooncake/mooncake.py · Avec Mooncake.html",
    "ローカルアドイン：mooncake/mooncake.py・Mooncake.html と同じフォルダ"
  ],
  "当前是本地管理员工具，无账号登录功能。设计文件保存在你的设备上。": [
    "Local admin tools; no account sign-in. Design files stay on your device.",
    "Outils admin locaux, sans connexion à un compte. Les fichiers restent sur votre appareil.",
    "ローカル管理ツールです。アカウント機能はなく、ファイルは端末に保存されます。"
  ],
  "确认月饼与配套模具": [
    "Confirm cake & mold",
    "Confirmer le modèle et le moule",
    "月餅と専用の型を確認"
  ],
  "沿用当前尺寸、花纹和居中文字，生成可拆装的手压月饼模具。": [
    "Use this size, pattern and lettering to create a detachable hand-press mold.",
    "Créez un moule à presse manuelle démontable avec les dimensions, le motif et le texte actuels.",
    "現在の寸法・模様・文字で、分解できる手押し式の型を作成します。"
  ],
  "月饼实体": [
    "Mooncake solid",
    "Solide du mooncake",
    "月餅のソリッド"
  ],
  "外套筒": [
    "Outer sleeve",
    "Corps du moule",
    "外筒"
  ],
  "匹配花边内腔 · 双侧握耳 · 推杆导向孔": [
    "Matching cavity · Side grips · Rod guide",
    "Cavité assortie · Poignées · Guide de tige",
    "輪郭に合う内壁・両側の持ち手・ガイド穴"
  ],
  "可更换压片": [
    "Replaceable stamp",
    "Tampon interchangeable",
    "交換式の押し型"
  ],
  "镜像凹纹 · 压出正向凸字 · M8 盲孔": [
    "Mirrored recess · Raised lettering · M8 blind hole",
    "Creux en miroir · Texte en relief · Trou borgne M8",
    "反転した凹模様・正向きの凸文字・M8 止まり穴"
  ],
  "推杆与手柄": [
    "Rod & handle",
    "Tige et poignée",
    "押し棒とハンドル"
  ],
  "M8 螺柱固定压片 · 手动推压脱模": [
    "M8 stamp attachment · Manual release",
    "Fixation M8 · Démoulage manuel",
    "M8 ねじで型を固定・手動で押し出し"
  ],
  "径向间隙": [
    "Radial clearance",
    "Jeu radial",
    "半径方向の隙間"
  ],
  "套筒壁厚": [
    "Sleeve wall",
    "Paroi du moule",
    "外筒の壁厚"
  ],
  "压片厚度": [
    "Stamp thickness",
    "Épaisseur du tampon",
    "押し型の厚さ"
  ],
  "间隙用于压片与套筒配合；内腔保持月饼标称尺寸。M8 × 1.25 螺纹用于换片，首次制作建议先试装。": [
    "Clearance allows the stamp to slide inside the sleeve; the cavity keeps the cake’s nominal size. The stamp uses an M8 × 1.25 thread. Test the fit before your first use.",
    "Le jeu permet au tampon de coulisser ; la cavité garde les dimensions nominales. Le tampon utilise un filetage M8 × 1,25. Faites un essai d’assemblage avant utilisation.",
    "押し型が外筒内を動くための隙間です。内腔は指定寸法を保ちます。交換用ねじは M8 × 1.25。初回は組み付けをお試しください。"
  ],
  "已连接 Fusion 设计器": [
    "Connected to Fusion",
    "Connecté à Fusion",
    "Fusion に接続済み"
  ],
  "连接本机 Mooncake 插件；Fusion 未启动时将自动唤起。首次使用需将 mooncake 文件夹加入“脚本和附加模块”并启用“启动时运行”。": [
    "Connect to the local Mooncake add-in. Fusion opens automatically if needed. First, add the mooncake folder in Scripts and Add-Ins and enable Run on Startup.",
    "Connexion au module Mooncake local. Fusion s’ouvre si nécessaire. Ajoutez d’abord le dossier mooncake dans Scripts et compléments, puis activez l’exécution au démarrage.",
    "ローカルの Mooncake に接続します。Fusion は必要に応じて起動します。初回は「スクリプトとアドイン」に mooncake フォルダを登録し、起動時の実行を有効にしてください。"
  ],
  "正在连接 Fusion…": [
    "Connecting to Fusion…",
    "Connexion à Fusion…",
    "Fusion に接続中…"
  ],
  "确认并导入 Fusion": [
    "Confirm & import",
    "Confirmer et importer",
    "確認して Fusion に読み込む"
  ],
  "让心意，慢慢成形": [
    "Make something personal",
    "Créez un cadeau personnel",
    "想いを、少しずつ形に"
  ],
  "选一个喜欢的轮廓": [
    "Find your shape",
    "Choisissez votre contour",
    "好きな輪郭を選ぶ"
  ],
  "设置直径与厚度，挑选花边。拖动月饼可以查看每个角度。": [
    "Set the diameter, thickness and edge. Drag the cake to see it from any angle.",
    "Réglez le diamètre, l’épaisseur et le contour. Faites glisser le modèle pour le tourner.",
    "直径と厚さを設定して側面の模様を選びます。ドラッグすると全方向から確認できます。"
  ],
  "给团圆添点花样": [
    "Add a pattern",
    "Ajoutez un motif",
    "模様を添える"
  ],
  "选择参数化花纹，或上传黑白图案制作浮雕。花纹直径和凸起高度都可以调整。": [
    "Choose a pattern or turn a black-and-white image into relief. Adjust its diameter and height.",
    "Choisissez un motif ou transformez une image noir et blanc en relief. Réglez son diamètre et sa hauteur.",
    "模様を選ぶか、白黒画像から浮き彫りを作ります。模様の直径と高さも調整できます。"
  ],
  "把祝福刻在中间": [
    "Add your message",
    "Gravez votre message",
    "中央に文字を刻む"
  ],
  "输入最多两个汉字或五个英文字母，英文可沿内圈排列。满意后保存定制订单，交给商家确认制作。": [
    "Add up to two Chinese characters or five English letters. English can follow the inner circle. Save your order file and confirm production with the maker.",
    "Saisissez deux caractères chinois ou cinq lettres anglaises maximum. L’anglais peut suivre le cercle intérieur. Enregistrez la commande et confirmez la fabrication avec le fabricant.",
    "漢字 2 文字または英字 5 文字まで入力できます。英字は内側の円に沿って配置できます。完成したら注文を保存し、販売者と製作内容を確認します。"
  ],
  "厚度指饼身高度，浮雕会额外凸起。预览颜色仅用于展示，实际效果以制作工艺为准。": [
    "Thickness refers to the cake body; relief adds extra height. Preview colors are illustrative. Final appearance depends on production.",
    "L’épaisseur est celle du corps ; le relief ajoute de la hauteur. Les couleurs sont indicatives. Le résultat dépend de la fabrication.",
    "厚さは本体の高さです。浮き彫りの分だけ全高が増えます。色はイメージで、仕上がりは製作方法により異なります。"
  ],
  "页面遇到了一点问题": [
    "Something went wrong",
    "Un problème est survenu",
    "ページに問題が発生しました"
  ],
  "请重新加载后继续设计。": [
    "Reload the page to keep designing.",
    "Rechargez la page pour continuer.",
    "ページを再読み込みしてください。"
  ],
  "重新加载": [
    "Reload",
    "Recharger",
    "再読み込み"
  ],
  "无法读取 Fusion 建模结果，请检查 Fusion 窗口。": [
    "Cannot read the modeling result. Check the Fusion window.",
    "Résultat illisible. Vérifiez la fenêtre Fusion.",
    "結果を読み取れません。Fusion の画面をご確認ください。"
  ],
  "Fusion 未能完成此操作。": [
    "Fusion could not complete this operation.",
    "Fusion n’a pas pu terminer l’opération.",
    "Fusion で操作を完了できませんでした。"
  ],
  "操作已完成。": [
    "Done.",
    "Opération terminée.",
    "完了しました。"
  ],
  "请先上传参考图案。": [
    "Upload an image first.",
    "Importez d’abord une image.",
    "先に画像を読み込んでください。"
  ],
  "设计 JSON 已下载，可在 Fusion 360 中导入。": [
    "Design JSON downloaded. Import it into Fusion 360.",
    "JSON téléchargé. Vous pouvez l’importer dans Fusion 360.",
    "JSON を保存しました。Fusion 360 に読み込めます。"
  ],
  "月饼与三件模具已在 Fusion 中生成，F3D 已保存。": [
    "The cake and three mold parts are ready in Fusion. F3D saved.",
    "Le mooncake et les trois pièces du moule sont prêts dans Fusion. F3D enregistré.",
    "月餅と型の 3 パーツを Fusion で生成し、F3D を保存しました。"
  ],
  "设计文件不能超过 4 MB。": [
    "Design files must be under 4 MB.",
    "Le fichier doit faire moins de 4 Mo.",
    "デザインファイルは 4 MB 以下にしてください。"
  ],
  "设计已恢复。": [
    "Design restored.",
    "Modèle restauré.",
    "デザインを復元しました。"
  ],
  "文件不是有效的 JSON。": [
    "This file is not valid JSON.",
    "Ce fichier n’est pas un JSON valide.",
    "有効な JSON ファイルではありません。"
  ],
  "请先完成图案设计。": [
    "Finish your pattern first.",
    "Terminez d’abord votre motif.",
    "先に模様のデザインを完成させてください。"
  ],
  "已恢复初始设计。": [
    "Default design restored.",
    "Modèle initial restauré.",
    "初期デザインに戻しました。"
  ],
  "当前环境未启用 WebGL，无法显示 3D 预览。请使用 Chrome 或开启硬件加速。": [
    "WebGL is unavailable. Use Chrome or enable hardware acceleration for the 3D preview.",
    "WebGL indisponible. Utilisez Chrome ou activez l’accélération matérielle pour l’aperçu 3D.",
    "WebGL が無効です。Chrome を使うか、ハードウェアアクセラレーションを有効にしてください。"
  ],
  "3D 预览暂时中断，请重新加载页面。设计参数已保存在本机。": [
    "3D preview interrupted. Reload the page; your settings are saved locally.",
    "Aperçu 3D interrompu. Rechargez la page ; vos réglages sont enregistrés localement.",
    "3D 表示が中断しました。設定は端末に保存されています。再読み込みしてください。"
  ],
  "图片细节过多，请换用轮廓更清晰、背景更简洁的图片。": [
    "The image is too complex. Use clearer outlines and a simpler background.",
    "Image trop complexe. Choisissez des contours plus nets et un fond plus simple.",
    "画像が複雑すぎます。輪郭が明確で背景がシンプルな画像をご使用ください。"
  ],
  "请选择 Mooncake 导出的 v1 毫米制设计 JSON。": [
    "Choose a Mooncake v1 design JSON in millimeters.",
    "Choisissez un JSON Mooncake v1 en millimètres.",
    "Mooncake から書き出した v1・mm 単位の JSON を選択してください。"
  ],
  "花纹类型或文字格式无效。": [
    "Invalid pattern or text format.",
    "Motif ou format du texte invalide.",
    "模様または文字の形式が無効です。"
  ],
  "尺寸超出范围，请检查 JSON。": [
    "Dimensions are out of range. Check the JSON.",
    "Dimensions hors limites. Vérifiez le JSON.",
    "寸法が範囲外です。JSON をご確認ください。"
  ],
  "图片高度数据无效。": [
    "Invalid image height data.",
    "Données de relief invalides.",
    "画像の高さデータが無効です。"
  ],
  "该设计缺少图片高度数据。": [
    "This design is missing image height data.",
    "Données de relief manquantes.",
    "画像の高さデータがありません。"
  ],
  "模具参数无效。": [
    "Invalid mold settings.",
    "Paramètres du moule invalides.",
    "型の設定が無効です。"
  ],
  "支持 PNG、JPG 或 WebP 图片。": [
    "Use a PNG, JPG or WebP image.",
    "Utilisez une image PNG, JPG ou WebP.",
    "PNG、JPG、WebP の画像をご使用ください。"
  ],
  "图片请小于 10 MB。": [
    "Images must be under 10 MB.",
    "L’image doit faire moins de 10 Mo.",
    "画像は 10 MB 以下にしてください。"
  ],
  "Fusion 连接失败。": [
    "Fusion connection failed.",
    "Connexion à Fusion impossible.",
    "Fusion に接続できませんでした。"
  ],
  "正在连接本机 Fusion…": [
    "Connecting to local Fusion…",
    "Connexion à Fusion local…",
    "この端末の Fusion に接続中…"
  ],
  "正在打开 Fusion，请允许浏览器打开应用…": [
    "Opening Fusion. Allow your browser to open the app…",
    "Ouverture de Fusion. Autorisez le navigateur à ouvrir l’application…",
    "Fusion を開きます。ブラウザからアプリを開くことを許可してください…"
  ],
  "尚未连接到 Mooncake。请在 Fusion 的“脚本和附加模块”中运行 mooncake，并启用“启动时运行”，然后重试。": [
    "Mooncake is not connected. Run mooncake in Fusion’s Scripts and Add-Ins, enable Run on Startup, then retry.",
    "Mooncake n’est pas connecté. Lancez mooncake dans Scripts et compléments de Fusion, activez l’exécution au démarrage, puis réessayez.",
    "Mooncake に未接続です。Fusion の「スクリプトとアドイン」で実行し、起動時の実行を有効にしてから再試行してください。"
  ],
  "本机连接版本不兼容，请更新 Mooncake 插件。": [
    "Incompatible connection version. Update the Mooncake add-in.",
    "Version incompatible. Mettez à jour le module Mooncake.",
    "接続のバージョンが非対応です。Mooncake アドインを更新してください。"
  ],
  "Fusion 建模失败。": [
    "Fusion modeling failed.",
    "Échec de la modélisation Fusion.",
    "Fusion のモデリングに失敗しました。"
  ],
  "Fusion 仍在处理此设计，请查看 Fusion 的进度；请勿重复提交。": [
    "Fusion is still processing. Check its progress before submitting again.",
    "Fusion travaille encore. Vérifiez sa progression avant de renvoyer le modèle.",
    "Fusion で処理中です。再送信せずに進捗をご確認ください。"
  ],
  "设计已送达 Fusion，等待创建实体…": [
    "Design received by Fusion. Waiting to create solids…",
    "Modèle reçu par Fusion. Création des solides en attente…",
    "Fusion にデザインを送信しました。生成を待っています…"
  ],
  "Fusion 正在生成月饼与三件模具…": [
    "Fusion is creating the cake and three mold parts…",
    "Fusion crée le mooncake et les trois pièces du moule…",
    "Fusion で月餅と型の 3 パーツを生成中…"
  ],
  "月饼与三件模具已创建，装配文件已保存。": [
    "Cake and three mold parts created. Assembly saved.",
    "Mooncake et trois pièces créés. Assemblage enregistré.",
    "月餅と型の 3 パーツを作成し、アセンブリを保存しました。"
  ],
  "月饼、外套筒、镜像凹纹压片及螺纹推杆已创建，可分别导出。": [
    "Cake, sleeve, mirrored stamp and threaded rod are ready to export.",
    "Mooncake, corps, tampon en miroir et tige filetée sont prêts à exporter.",
    "月餅・外筒・反転した押し型・ねじ付き押し棒を生成しました。個別に書き出せます。"
  ],
  "正在 Fusion 中创建月饼与配套模具…": [
    "Creating the cake and mold in Fusion…",
    "Création du mooncake et du moule dans Fusion…",
    "Fusion で月餅と型を作成中…"
  ],
  "设计 JSON 已保存。": [
    "Design JSON saved.",
    "JSON du modèle enregistré.",
    "デザイン JSON を保存しました。"
  ],
  "已取消导出。": [
    "Export canceled.",
    "Export annulé.",
    "書き出しをキャンセルしました。"
  ],
  "已有建模任务正在进行，请稍候。": [
    "Modeling is already in progress. Please wait.",
    "Une modélisation est en cours. Veuillez patienter.",
    "モデリングを実行中です。しばらくお待ちください。"
  ],
  "实体已创建，但 F3D 保存失败，请在 Fusion 中手动保存。": [
    "Solids created, but F3D could not be saved. Save manually in Fusion.",
    "Solides créés, mais échec de l’enregistrement F3D. Enregistrez dans Fusion.",
    "ソリッドは作成できましたが F3D の保存に失敗しました。Fusion で手動保存してください。"
  ]
};
export function translate(locale, key) {
  if (locale === 'zh' || !key) return key;
  const column = { en: 0, fr: 1, ja: 2 }[locale];
  if (MESSAGES[key]) return MESSAGES[key][column] || key;
  if (key.startsWith('设计参数 ') && key.endsWith(' 无效。')) return ({ en: 'Invalid design parameter: ', fr: 'Paramètre invalide : ', ja: '無効なデザイン設定：' })[locale] + key.slice(5, -4);
  return key;
}
