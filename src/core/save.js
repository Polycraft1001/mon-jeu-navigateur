// =====================================================
//  SAUVEGARDE (dans le navigateur, localStorage)
// =====================================================
import { CARS, COLORS, TIME_SET, ASSIST, TRAFFIC_COUNT, WEAPONS } from './config.js';

const SAVE_KEY = 'turboCity3d';
export const save = { car: 0, color: 0, time: 'day', traffic: 1, assist: 'normal', bestDrift: 0, missions: 0, money: 0, weapon: 1 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* rien */ }
if (!CARS[save.car]) save.car = 0;
if (!COLORS[save.color]) save.color = 0;
if (!TIME_SET[save.time]) save.time = 'day';
if (!ASSIST[save.assist]) save.assist = 'normal';
if (TRAFFIC_COUNT[save.traffic] === undefined) save.traffic = 1;
if (!WEAPONS[save.weapon]) save.weapon = 1;

export const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* rien */ } };
