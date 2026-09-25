import requests, urllib.parse, time
qs=['Kaifeng Iron Pagoda','Iron Pagoda China','Iron Tower Kaifeng','Yingtianmen','Yingtian Gate','Luoyang Gate','Qingming Shanghe Yuan','Along the River During the Qingming Festival park','Shanhaiguan','First Pass under Heaven','Hongcun China','Wudadao','Five Great Avenues Tianjin','Hongyadong','Chongqing stilt houses','Suzhou garden China','Humble Administrator Garden','Tianyige Pavilion','Chengyang Wind Rain Bridge','Chengyang Bridge','Haikou arcade','Qilou Haikou','Dujiangyan','Zhaoxing village','Lijiang old town China','Potala?','Kumbum Monastery','Taer Temple','Western Xia Mausoleum','Xixia Mausoleums','Kashgar old city','Wudangzhao','Shenyang Palace','Mukden Palace','Manchukuo Palace','Longshan Temple Taipei']
for q in qs:
 try:
  j=requests.get('https://api.sketchfab.com/v3/search',params={'type':'models','q':q},timeout=20).json()
  print('\n'+q, len(j.get('results',[])))
  for x in j.get('results',[])[:8]: print(x['uid'],'|',x['name'],'|',x.get('user',{}).get('displayName'))
 except Exception as e: print('ERR',q,e)
 time.sleep(.3)
