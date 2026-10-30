# SUI-A02 图像制作提示

2026-10-28｜内置 `image_gen.imagegen`，透明背景；未使用CLI/API密钥。

共同参考：`assets/sources/20261028/SUI-A02/references/xiaoman-face-v2-reference.png`。这是既有face-v2外形参考，A/B仅比较呈现；没有重新选定身份、发型、服装或关系。

## Option A · 清晰半写实

Use case: identity-preserve.
Asset type: Chinese adult visual novel transparent character base candidate, Option A, clear semi-realistic rendering.
Input image 1 is the sole identity, hairstyle, body, clothing, pose and crop reference: the approved face-v2 depiction of Luo Xiaoman, an adult 22-year-old hair salon assistant.
Create one polished standalone character sprite based very closely on the reference. Preserve the same recognizable face, brown eyes, facial proportions, pale blonde short layered hair and parting, body proportions, small stud earrings, brick-red casual zip jacket with two off-white sleeve stripes, white crew-neck inner T-shirt, dark denim trousers, black wrist hair tie, relaxed three-quarter standing pose, one hand resting inside the trouser pocket and the other relaxed. Preserve the same upper-thigh crop. Do not extend the body to legs or feet. Retain an adult Japanese semi-realistic illustrated aesthetic, with fine controlled linework, detailed but restrained fabric rendering, clean natural skin and a small self-assured friendly smile. Use balanced soft neutral lighting, natural blonde hair and authentic brick-red cloth. Improve production readiness with clear silhouette and clean hair edges while staying faithful to the reference face. Do not turn this into a different woman, chibi, glossy fashion photo, extreme anime or beauty filter. Single character centered on a 1024 by 1536 portrait canvas. Leave a small transparent margin above the hair and on both sides; keep complete hands. A true transparent alpha background with absolutely no brown/black vignette, haze, glow, cast shadow, background color or scenery. Make the subject opaque apart from fine antialiased hair edges. No lettering, watermark, reference sheet, tools, notebook, scissors, props, other people or additional clothing. This is a basic presentation candidate only, no expression sheet or action variation.

## Option B · 克制手绘

Use case: identity-preserve.
Asset type: Chinese adult visual novel transparent character base candidate, Option B.
Input image 1 is the sole identity, hairstyle, body, clothing, pose and crop reference: the approved face-v2 depiction of Luo Xiaoman, an adult 22-year-old hair salon assistant.
Create one polished standalone character sprite of exactly the same woman and outfit. Preserve the same recognizable face, brown eyes, facial proportions, pale blonde short layered hair and parting, body proportions, small stud earrings, brick-red casual zip jacket with two off-white sleeve stripes, white crew-neck inner T-shirt, dark denim trousers, black wrist hair tie, relaxed three-quarter standing pose, one hand resting inside the trouser pocket and the other relaxed. Preserve the same upper-thigh crop. Do not extend the body to legs or feet. Compare a restrained hand-painted Japanese semi-realistic treatment: selective pencil-like contour, broad gentle matte color planes, subtle visible painterly brush texture within the silhouette, simpler fabric detail than the reference, a little less specular shine on face and hair, quietly expressive adult face with the same small self-assured friendly smile. Keep the same identity rather than redesigning the face. The jacket must remain recognizably brick-red, blonde must remain blonde; use softly balanced neutral ambient light suitable for later compositing in the project's rainy blue-gray UI. No blue tint painted into skin. Clearly distinguish this treatment through brushwork and simplified values, not by changing outfit, anatomy, age, hair length, facial identity or gesture. Single character centered on a 1024 by 1536 portrait canvas. Leave a small transparent margin above the hair and on both sides; keep complete hands. A true transparent alpha background with absolutely no brown/black vignette, haze, glow, cast shadow, paper-colored rectangle or scenery. Make the subject opaque apart from fine antialiased hair edges. No lettering, watermark, reference sheet, tools, notebook, scissors, props, other people or additional clothing. This is a basic presentation candidate only, no expression sheet or action variation.

## 已确认后的差分

用户已在本聊天选定Option A，之后的10张差分均引用A基础图。完整差分请求见`generation-requests.json`；B v002的加强笔触请求见`option-b-v002-prompt.txt`。裙长与头盔表情分别按`skirt-repair-v002-prompt.txt`、`helmets-v002-prompt.txt`返修，原件保留。当前交付为11张，未把B或返修旧稿混入。
