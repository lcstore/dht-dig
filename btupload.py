#!/usr/bin/python
# -*- coding: utf-8 -*-
import sys
import json
import requests
import time

reload(sys).setdefaultencoding('utf-8')
headers = {
    "Accept":"text/html,application/xhtml+xml,application/xml; " \
        "q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding":"text/html",
    "Accept-Language":"en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4,zh-TW;q=0.2",
    # "Content-Type":"application/x-www-form-urlencoded",
    "Content-Type":"application/json",
    "Referer":"http://www.lezomao.com/dig",
    "User-Agent":"Mozilla/5.0 (compatible; dig/1.0; +http://www.lezomao.com)"
}
ss = requests.session()

def make_id(infoHash):
   source = 'magnet;'+infoHash;
   source = source.lower()
   sCode = str(to_hash_code(source));
   sCode = sCode.replace('-','0');
   return 'm'+sCode;

def to_hash_code(infoHash):
    hash = 0
    for ch in infoHash:
        ich = ord(ch)
        hash  = ((hash << 5) - hash) + ich;
        hash |= 0;
    return convert_n_bytes(hash,4)
def convert_n_bytes(n, b):
    bits = b*8
    return (n + 2**(bits-1)) % 2**bits - 2**(bits-1)
def desc_file(a, b):
     return b['length'] - a['length'];
def submit_docs(docs):
    length = len(docs)
    if length<1:
        return 
    url = 'http://www.lezomao.com/clink/update/json?commit=true'
    r = ss.post(url,headers=headers, json=docs)
    print('length:'+str(length)+',rep:'+str(r.content))
def main():
    total=0
    docs = []
    for line in sys.stdin:
       line = line.strip()
       if(line.startswith('{') == False):
           continue
       # print(line)
       try:
           one_json = json.loads(line)
           str_data = one_json['data']
           data_json = json.loads(str_data)
           doc = {}
           doc['code'] = data_json['infohash'].upper()
           doc['link'] = 'magnet:?xt=urn:btih:'+doc['code']
           doc['protocol'] = 'magnet';
           doc['suffix'] = 'torrent';
           doc['type'] = 'p2pspider-torrent';
           doc['id'] = make_id(doc['code'])
           info_json = data_json['info']
           if 'address' in data_json and 'port' in data_json:
               doc['peer_s']=data_json['address']+':'+str(data_json['port'])
           if 'files' in info_json:
               files = info_json['files']
               files.sort(desc_file);
               paths = doc['paths']=[]
               lengths = doc['lengths']=[]
               for f in files:
                   paths.append(f['path'][0])
                   lengths.append(f['length'])
           if 'name' in info_json:
               doc['title'] = info_json['name']
           if 'length' in info_json:
               doc['space'] = info_json['length']
               # 2016-12-18T07:48:56.165Z
           creation =time.strftime('%Y-%m-%dT%H:%M:%S.001Z',time.localtime())
           doc['creation']={'add':creation}
           # print('doc:'+str(doc))
           docs.append(doc)
           total+=1
           if(len(docs)>=100):
               submit_docs(docs)
               docs = []
       except Exception as e:
           print("fatal error", e) 
           continue
    submit_docs(docs)
    print('done.total:'+str(total))
if __name__ == '__main__':
    main()