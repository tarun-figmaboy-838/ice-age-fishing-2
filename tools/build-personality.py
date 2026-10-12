#!/usr/bin/env python3
"""Pack generated character poses into registered RGBA atlases (Canvas + Playwright).

Original generations remain untouched in asset/animation-polish. Exterior generation
speckles are removed during packing; opaque interiors and antialiased edges survive.
"""
import base64
import json
import runpy
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PACK = r'''async ({url, columns, rows}) => {
 const img = new Image(); img.src=url; await img.decode();
 const frames=[];
 for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
  // Generated tips may extend into an otherwise empty gutter. Include that gutter;
  // the largest-component mask below discards any disconnected neighbouring pose.
  const x0=Math.max(0,Math.round(col*img.width/columns)-18), y0=Math.max(0,Math.round(row*img.height/rows)-24);
  const w=Math.min(img.width,Math.round((col+1)*img.width/columns)+18)-x0;
  const h=Math.min(img.height,Math.round((row+1)*img.height/rows)+24)-y0;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');g.drawImage(img,x0,y0,w,h,0,0,w,h);
  const pixels=g.getImageData(0,0,w,h),d=pixels.data,N=w*h;
  const exterior=new Uint8Array(N),queue=[];
  for(let i=0;i<N;i++) if(d[i*4+3]<24){exterior[i]=1;queue.push(i);}
  const neighbours=i=>{const x=i%w,y=Math.floor(i/w);return [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1];};
  // Flood exterior matte/chroma only, so the bird's orange beak and bear's mouth survive.
  for(let q=0;q<queue.length;q++) for(const j of neighbours(queue[q])) {
   if(j<0||exterior[j])continue;
   const r=d[j*4],gg=d[j*4+1],b=d[j*4+2];
   const matte=Math.min(r,gg,b)>225&&Math.max(r,gg,b)-Math.min(r,gg,b)<22;
   const chroma=r>185&&b<75&&(gg<75||gg>175);
   if(matte||chroma){exterior[j]=1;queue.push(j);}
  }
  const seen=new Uint8Array(N);let largest=[];
  for(let seed=0;seed<N;seed++) {
   if(seen[seed]||exterior[seed])continue;
   const group=[seed];seen[seed]=1;
   for(let q=0;q<group.length;q++)for(const j of neighbours(group[q])) {
    if(j<0||seen[j]||exterior[j])continue;seen[j]=1;group.push(j);
   }
   if(group.length>largest.length)largest=group;
  }
  const mask=new Uint8Array(N);for(const i of largest)mask[i]=d[i*4+3];
  let left=w,top=h,right=0,bottom=0;
  for(let i=0;i<N;i++) {
   const x=i%w,y=Math.floor(i/w);
   let edge=mask[i];
   if(edge) {
    const near=neighbours(i).map(j=>j<0?0:mask[j]);
    edge=Math.min(edge,Math.round((mask[i]*4+near.reduce((a,b)=>a+b,0))/8));
   }
   d[i*4+3]=edge>=245?255:edge;
   if(!edge)d[i*4]=d[i*4+1]=d[i*4+2]=0;
   if(edge>24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  }
  g.putImageData(pixels,0,0);
  // The lower body/feet locate the pelvis; wings and raised paws cannot shift the anchor.
  let sum=0,weight=0;
  for(let y=Math.floor(top+(bottom-top)*.76);y<bottom;y++)for(let x=left;x<right;x++) {
   const a=d[(y*w+x)*4+3]/255;sum+=x*a;weight+=a;
  }
  frames.push({c,left,top,right,bottom,pivot:sum/weight});
 }
 const size=256, atlas=document.createElement('canvas');atlas.width=columns*size;atlas.height=rows*size;
 const out=atlas.getContext('2d');
 // One scale for the whole atlas: do not inflate or shrink individual expressions.
 const maxH=Math.max(...frames.map(f=>f.bottom-f.top));
 const maxHalf=Math.max(...frames.map(f=>Math.max(f.pivot-f.left,f.right-f.pivot)));
 const scale=Math.min(214/maxH,110/maxHalf);
 const metadata=[];
 frames.forEach((f,i)=>{
  const x=i%columns*size,y=Math.floor(i/columns)*size;
  out.drawImage(f.c,x+128-f.pivot*scale,y+236-f.bottom*scale,f.c.width*scale,f.c.height*scale);
  metadata.push({box:[x,y,size,size],height:(f.bottom-f.top)*scale});
 });
 return {png:atlas.toDataURL('image/png').split(',')[1],metadata,scale};
}'''

def main():
    metadata = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for name, columns, rows in [('popo', 6, 6), ('swiftee', 4, 4), ('swiftee-front', 4, 3), ('popo-completion', 4, 3)]:
            source = ROOT / 'asset/animation-polish' / (name + '-source.png')
            result = page.evaluate(PACK, dict(url='data:image/png;base64,' + base64.b64encode(source.read_bytes()).decode(), columns=columns, rows=rows))
            target = ROOT / 'assets/sprites' / (name + '-personality.png')
            target.write_bytes(base64.b64decode(result['png']))
            metadata[name] = dict(columns=columns, rows=rows, cell=256, anchor=[128,236], frames=result['metadata'])
            print(target.relative_to(ROOT), target.stat().st_size, 'bytes', flush=True)
        # Append completion drawings at the old neutral body's scale. Existing frame
        # indices and source artwork remain intact; new Popo poses occupy indices 36–47.
        merged = page.evaluate('''async ({base,extra,oldHeight,newHeight})=>{
          const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
          const a=await load(base),b=await load(extra),c=document.createElement('canvas');
          c.width=1536;c.height=2048;const g=c.getContext('2d');g.drawImage(a,0,0);
          const scale=oldHeight/newHeight;
          for(let i=0;i<12;i++){
            const x=(36+i)%6*256,y=Math.floor((36+i)/6)*256;
            g.drawImage(b,i%4*256,Math.floor(i/4)*256,256,256,
              x+128-128*scale,y+236-236*scale,256*scale,256*scale);
          }
          return {png:c.toDataURL('image/png').split(',')[1],scale};
        }''',dict(base='data:image/png;base64,'+base64.b64encode((ROOT/'assets/sprites/popo-personality.png').read_bytes()).decode(),
                  extra='data:image/png;base64,'+base64.b64encode((ROOT/'assets/sprites/popo-completion-personality.png').read_bytes()).decode(),
                  oldHeight=metadata['popo']['frames'][0]['height'],newHeight=metadata['popo-completion']['frames'][0]['height']))
        (ROOT/'assets/sprites/popo-personality.png').write_bytes(base64.b64decode(merged['png']))
        for i, frame in enumerate(metadata['popo-completion']['frames']):
            index=36+i
            metadata['popo']['frames'].append(dict(box=[index%6*256,index//6*256,256,256],height=frame['height']*merged['scale']))
        metadata['popo']['rows']=8
        browser.close()
    (ROOT / 'src/personality-data.js').write_text('// Generated by tools/build-personality.py.\nwindow.PopoGame = window.PopoGame || {};\nPopoGame.PERSONALITY_DATA = ' + json.dumps(metadata, separators=(',', ':')) + ';\n')
    # the game loads lossless WebP copies of the sheets (tools/build-webp.py)
    webp = runpy.run_path(str(ROOT / 'tools/build-webp.py'))
    webp['build'](['popo-personality', 'swiftee-personality', 'swiftee-front-personality'])

if __name__ == '__main__':
    main()
