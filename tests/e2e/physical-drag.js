// Browser touch input, not synthetic DOM events. The visible tile centre is
// north of the finger, matching the production gesture's destination hit test.
export async function touchDrag(page,source,destination){
 const from=await source.boundingBox();
 const pointer=await page.context().newCDPSession(page),x=from.x+from.width/2,y=from.y+from.height/2;
 const send=(type,x,y)=>pointer.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,radiusX:8,radiusY:8,force:1,id:1}]});
 try{
  await send('touchStart',x,y);await send('touchMove',x+10,y);
  const to=await destination.boundingBox(),cell=await destination.getAttribute('data-cell');
  const size=await destination.evaluate(el=>{const cell=el.closest('[data-cell-wrapper]');return cell.getBoundingClientRect().width*(parseFloat(getComputedStyle(cell).getPropertyValue('--piece-size'))||90)/100;});
  await send('touchMove',to.x+to.width/2,to.y+to.height/2+size/1.1547005384*.7+8);
  await send('touchEnd',0,0);return cell;
 }finally{await pointer.detach();}
}
