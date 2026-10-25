# QA book: a 20-page two-up PDF with the three real scanned printed pages placed where the
# real book has them (19 -> PDF 10 right, 20 -> PDF 11 left, 29 -> PDF 15 right). Other halves blank.
from PIL import Image, ImageDraw
import os
R=os.environ.get('QA_PAGES', '/mnt/project-files/textbook-exercise-extraction/real/')
place={(10,'R'):'p19',(11,'L'):'p20',(15,'R'):'p29'}
pages=[]
for n in range(1,21):
    im=Image.new('RGB',(2200,1556),'white'); d=ImageDraw.Draw(im)
    for side,x in (('L',0),('R',1100)):
        if (n,side) in place: im.paste(Image.open(R+place[(n,side)]+'.png').convert('RGB'),(x,0))
        else: d.text((x+500,1500),'QA blank',fill='gray')
    pages.append(im)
pages[0].save('qa-book.pdf',save_all=True,append_images=pages[1:],resolution=150)
