from bs4 import BeautifulSoup
h=open('mic.html',encoding='utf-8').read(); s=BeautifulSoup(h,'html.parser')
for h2 in s.select('h2.product-name')[:30]:
 a=h2.select_one('a[title]');
 if not a: continue
 p=h2
 for _ in range(4):
  p=p.parent
  if p.select_one('.price'):
   print(a['title'],'|',p.select_one('.price').get_text(' ',strip=True)); break
