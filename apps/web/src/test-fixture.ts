import type { LevelDTO } from '@graphway/contracts';
export const level:LevelDTO={
 id:'L01',version:'graphway-v1',episodeId:'linear',title:'Подъём',focus:'b',goal:'Соедини области',theoryKey:'linear-b',controls:[{name:'b',mode:'slider-input'}],initial:{b:'0'},functionSpec:{family:'linear'},fixed:{k:1},geometry:{start:{x:-3,y:-1,r:0.8},goal:{x:3,y:5,r:0.8},pits:[],domain:{min:-6,max:6}},
 theory:{focus:'Вертикальный сдвиг',activeCoefficientMeaning:'b = f(0)',fixedCoefficientMeaning:'k = 1',blocks:[{kind:'formula',content:'y=kx+b'}],example:{prompt:'Пусть k = 2, b = 2',steps:['Подставим x = −1: y = 0','Подставим x = 3: y = 8'],check:'Прямая проходит через (−1; 0) и (3; 8).'}}
};
