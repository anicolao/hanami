// CSS viewport sizes, independent of the surrounding lab controls.
export const viewports = [
 {id:'ipad-air-landscape',name:'iPad Air · landscape',width:1180,height:820},
 {id:'ipad-landscape',name:'iPad · landscape',width:1024,height:768},
 {id:'phone-landscape',name:'Phone · landscape',width:844,height:390},
 {id:'phone-compact-landscape',name:'Compact phone · landscape',width:667,height:375},
 {id:'desktop',name:'Desktop',width:1440,height:900},
];
export const routePath = (route,base='/') => `${base}${route==='tabletop'?'tabletop/':''}`;
