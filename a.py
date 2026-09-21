import requests,re
from bs4 import BeautifulSoup
urls=['https://lookingglassfactory.com/looking-glass-65','https://lookingglassfactory.com/looking-glass-8','https://lookingglassfactory.com/looking-glass-16']
for u in urls:
 h=requests.get(u).text; s=BeautifulSoup(h,'html.parser'); print('\n',u)
 print(' '.join(s.get_text(' ',strip=True).split())[:1500])
 for x in re.findall(r'\$[0-9,]+',h): print(x,end=' ')
