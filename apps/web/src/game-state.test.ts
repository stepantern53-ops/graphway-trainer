import { describe, it, expect } from 'vitest';
import { createGame, gameReducer, robotMood } from './game/game-state';
import { level } from './test-fixture';

describe('game state consumer',()=>{
 it('removes a ready graph and launch when raw input becomes incomplete',()=>{
  let s=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
  expect(s.validation.status).toBe('ready');
  s=gameReducer(s,{type:'edit',name:'b',raw:'1/'});
  expect(s.status).toBe('editing-invalid');
  expect(gameReducer(s,{type:'launch'}).snapshot).toBeNull();
 });
 it('freezes launch, prevents edits/double launch and confirms only actual arrival',()=>{
  let s=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
  s=gameReducer(s,{type:'launch'}); const snapshot=s.snapshot;
  expect(s.status).toBe('riding');
  expect(gameReducer(s,{type:'launch'}).snapshot).toBe(snapshot);
  expect(gameReducer(s,{type:'edit',name:'b',raw:'3'}).raw.b).toBe('2');
  expect(gameReducer(s,{type:'completionAccepted'}).status).toBe('riding');
  s=gameReducer(s,{type:'tick',delta:1500,duration:3000});
  expect(s.status).toBe('riding');
  s=gameReducer(s,{type:'tick',delta:1500,duration:3000});
  expect(s.status).toBe('arrived-pending');
  s=gameReducer(s,{type:'completionFailed',message:'Сеть'});
  expect(s.snapshot).toBe(snapshot);
  expect(gameReducer(s,{type:'retry'}).status).toBe('arrived-pending');
 });
 it('exit cancels ride but retains fields and requires a fresh launch',()=>{
  let s=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
  s=gameReducer(s,{type:'launch'});
  s=gameReducer(s,{type:'exit'});
  expect(s.raw.b).toBe('2'); expect(s.snapshot).toBeNull(); expect(s.status).toBe('editing-valid');
 });
 it('only confirmed completion produces robot success, never launch or arrival',()=>{
  let s=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
  expect(robotMood(s)).toBe('idle');
  s=gameReducer(s,{type:'launch'});
  expect(robotMood(s)).toBe('attention');
  s=gameReducer(s,{type:'tick',delta:3000,duration:3000});
  expect(robotMood(s)).toBe('idle');
  s=gameReducer(s,{type:'completionFailed',message:'Сеть'});
  expect(robotMood(s)).toBe('idle');
  s=gameReducer(s,{type:'retry'});
  s=gameReducer(s,{type:'completionAccepted'});
  expect(robotMood(s)).toBe('success');
 });
});
