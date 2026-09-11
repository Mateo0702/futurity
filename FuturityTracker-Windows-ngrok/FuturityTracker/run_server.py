"""Isolated Tracker service. No process termination or Atlas configuration changes."""
import argparse
import socket
import sys
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description='Futurity Tracker independiente')
    parser.add_argument('--host',choices=['127.0.0.1','0.0.0.0'],default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8810)
    args=parser.parse_args()
    if not 1024 <= args.port <= 65535: parser.error('Use a port between 1024 and 65535')
    try:
        with socket.socket() as check: check.bind((args.host,args.port))
    except OSError:
        parser.exit(1, f'El puerto {args.port} no está disponible. No se detuvo ningún proceso.\n')
    sys.path.insert(0,str(Path(__file__).resolve().parent/'backend'))
    import uvicorn
    uvicorn.run('main:app',host=args.host,port=args.port,proxy_headers=True,forwarded_allow_ips='127.0.0.1')

if __name__=='__main__':main()
