//Mod: Oil Finite (of)
//By EuPhobos
//License GPL v2
namespace("of_");
var of_ver = "v2.00";
queue("of_inits", 1000);
/*



v2.00
Удалены из мода stats, они не нужны больше
Переписан весь код мода
Устранены event-конфликты с rules.js и другими модами.
rules.js обновлён до версии 3.3.0
Теперь при клике по занятой своей нефтевышке, отображается процент оставшейся нефти.
Теперь если не хватает генераторов, нефтевышки не тратят свой ресурс (Проблема 1 исправлена) 
Приоритетное выкачивание с дальних нефтевышек, если не хватает генераторов, сперва выкачиваются самые дальние нефтевышки.
Теперь нефтевышка не исчезает при её уничтожении атакой, а догорает вместе с огнём (Проблема 2 исправлена)
Если нефтевышек меньше кол-ва игроков, на карте в случайном, но доступном месте появляются новые нефтевышки.

v1.00
Initial release
Почти всё задуманное - работает.
Проверено на версии 3.3.0b1

Проблема 1:
Невозможно получить состояние нефтевышки (качает/простаивает)
Поэтому построенные нефтевышки начинают уменьшать кол-во нефти, даже если не хватает генераторов.

Проблема 2:
Невозможно получить состояние горения нефтеточки (не страшно)
Так как нет способов раньше времени потушить горение нефти,
То просто в момент взрыва нефтевышки, высчитываем горение нефти + время горения

*/

//This mod enabled by default
var of_enabled = true;

//Рандомное появление новых месторождений на карте
var of_oilSpawn = true;

//Размещать бочку на месте сгоревшей нефти
//Place a barrel on the burned out oilwells
var of_lastBarrel = true;

//Дополнительные правила:
//Если Command Relay Center установлен у игрока, то его нефтевышки расходуют в 2 раза меньше нефти при том же приросте энергии.
//Additions game rules:
//If Command Relay Center builded by player, his oilwells drain half slower with same power gain rate.
var of_relayControl = true;

//Количество нефти в стартовых месторождениях занятых игроком
//Amount of oil on the oilwells occupied by player from start of the game
var of_amountOil = 1700;

//Количество нефти в стартовых месторождениях не занятых игроком
//Amount of oil on the free oilwells
var of_amountFreeOil = 2000;

//Истощение точки в секунду при удержании мусорщиками
//Pumping oil by scavengers in game second
var of_scavDrain = 0.1;

//Истощение точки в секунду при удержании игроком/ботом
//Pumping oil by player/bots in game second
var of_playerDrain = 2;

//Иссыхание свободной точки в секунду (по умолчанию нет)
//Drying of an unoccupied oil rig (not allowed by default)
var of_freeDrain = 0;

//Горение нефти в секунду
//Buring out oil
var of_fireDrain = 10;



//---===---\\

//Время горения нефти (хардкод в игре)
//Burning oil time (hardcoded in game)
var of_burnTime = 60;

//Максимальный запас, установленный модом
var of_oilMax = Math.max(of_amountOil, of_amountFreeOil);

//Количество нефти в новых месторождениях
var of_amountNewOil = Math.round(of_amountOil/4);

//Массив скважен
var of_wells = {};
var of_burning = {};

var of_init = false;

function of_inits(){
	if(!of_enabled) return;
	
	//Берём все не занятые нефтевышки
	var freeWells = enumFeature(ALL_PLAYERS, "OilResource");
	//Добавляем в базу of_wells незанятые
	for(var o in freeWells){
		var idOil = freeWells[o].x+"x"+freeWells[o].y;
		of_newWells(idOil, of_amountFreeOil);
	}
	
	//Массив занятых нефтевышек
	var playerWells = [];
	//Берём все занятые игроками
	for ( var e = 0; e < maxPlayers; ++e ) playerWells = playerWells.concat(enumStruct(e, "A0ResourceExtractor"));
	//Берём все занятые мусорщиками
	if(scavengers == true){playerWells = playerWells.concat(enumStruct(scavengerPlayer, "A0ResourceExtractor"));}
	//Добавляем в базу of_wells занятые
	for(var o in playerWells){
		var idOil = playerWells[o].x+"x"+playerWells[o].y;
		of_newWells(idOil, of_amountOil);
	}
	
	if(!of_init){
		of_init = true;
		debugMsg("Mod Running: Oil Finite "+of_ver);
		debugMsg("Finite oil wells: "+Object.keys(of_wells).length);
	}
	setTimer("of_iterOils", 1000);
}



function of_iterOils(){
	
	//Общитываем (или обсчитывем?) занятую мусорщиками нефть
	if(scavengers == true){
		var scavWells = enumStruct(scavengerPlayer, "A0ResourceExtractor");
		for (var o in scavWells){of_wells[scavWells[o].x+'x'+scavWells[o].y]-=of_scavDrain;}
	}

	//Общитываем занятую игроками нефть
	for ( var e = 0; e < maxPlayers; ++e ){
		//Получаем всю занятую игроком нефть
		var playerWells = enumStruct(e, RESOURCE_EXTRACTOR).filter(function(e){if(e.status == BUILT)return true;return false;});
		
		var relayCentre = [];
		if(of_relayControl) relayCentre = enumStruct(e, COMMAND_CONTROL).filter(function(e){if(e.status == BUILT)return true;return false;});
		
		//Получаем стартовую позицию игрока
		var base = startPositions[e];

		//Сортируем занятые нефтевышки от стартовой позиции игрока
		playerWells = sortByDistance(playerWells, base).reverse();
		//Получаем кол-во работающих электростанций
		var powerplants = enumStruct(e, POWER_GEN).filter(function(e){if(e.status == BUILT)return true;return false;});

		var i = 0;
		for(var o in playerWells){
			i++;
			if(i > powerplants.length*4) break;
//			debugMsg("oil: "+distBetweenTwoPoints(base.x,base.y,playerWells[o].x,playerWells[o].y)+" "+playerWells[o].x+"x"+playerWells[o].y+" "+of_wells[playerWells[o].x+"x"+playerWells[o].y]);
			if(of_relayControl && relayCentre.length != 0) of_wells[playerWells[o].x+"x"+playerWells[o].y]-=(of_playerDrain/2);
			else of_wells[playerWells[o].x+"x"+playerWells[o].y]-=of_playerDrain;
		}
	}
	
	//Общитываем горящую нефть
	if(Object.keys(of_burning).length){
		for(var o in of_burning){
			if(isNaN(of_burning[o]) || isNaN(of_wells[o]) || of_burning[o] <= 0){
				delete of_burning[o];
				continue;
			}
			of_burning[o]--;
			of_wells[o]-=of_fireDrain;
			debugMsg("oilburn: "+o+":"+of_wells[o]+" "+of_burning[o]);
		}
	}
	
	//Общитываем незанятую нефть (иссыхание)
	//Если включено
	if(of_freeDrain){
		var freeWells = enumFeature(ALL_PLAYERS, "OilResource");
		for(var o in freeWells){
			of_wells[freeWells[o].x+"x"+freeWells[o].y]-=of_freeDrain;
		}
	}
	
	//Проверяем законченные месторождениях
	if(Object.keys(of_wells).length){
		for(var o in of_wells){
			if(of_wells[o]<=0 || isNaN(of_wells[o])){
				//Парсим координаты
				var coords = o.split('x');
				//Берём объект по координатам
				var oil = getObject(coords[0], coords[1]);
				if(!oil)continue;
				//Если он пренадлежит игроку, значит это нефтевышка
				if(oil.player != 12){
					//Удаляем нефтевышку со взрывом
					removeObject(oil,true);
					//Игра поставит нефтерождение взамен, берём по координатам и удаляем без взрыва и нефтерождение
					removeObject(getObject(coords[0], coords[1]), false);
				}else{
					//Удаляем нефтерождение со взрывом
					removeObject(oil,true);
				}
				
				if(of_lastBarrel){
					//Размещаем бочку на месте ресурса.
					addFeature("OilDrum", coords[0], coords[1]);
				}
				
				if(of_burning[o]) delete of_burning[o];
				delete of_wells[o];
			}
		}
	}
	
	//Если количество нефтеточек меньше игроков, добавляем рандомно
	if(of_oilSpawn && Object.keys(of_wells).length < maxPlayers){
//		debugMsg("Oils: "+Object.keys(of_wells).length);
		var x = syncRandom(mapWidth - 20) + 10;
		var y = syncRandom(mapHeight - 20) + 10;
		
		var reachable = false;
		for ( var e = 0; e < maxPlayers; ++e ){
			if(propulsionCanReach("hover01", x, y, startPositions[e].x, startPositions[e].y)){
				reachable = true;
				break;
			}
		}
		if(reachable){
			addFeature("OilResource", x, y);
			of_newWells(x+"x"+y, of_amountNewOil);
		}
	}
	
}

function of_eventSelectionChanged(obj){
	if(!of_enabled) return;
	if(obj.length==0)return;
	if( obj[0].player == me && obj[0].type == 1 && obj[0].stattype == 5 ){
		console("Oil remain: "+Math.floor(of_wells[obj[0].x+'x'+obj[0].y]*100/of_oilMax)+"%");
		debugMsg("Oil remain: "+Math.floor(of_wells[obj[0].x+'x'+obj[0].y]*100/of_oilMax)+"% "+obj[0].x+'x'+obj[0].y+":"+of_wells[obj[0].x+'x'+obj[0].y]);
	}
}
function of_eventDestroyed(victim){
	if(!of_enabled) return;
	//Высчитываем горение нефти
	if(victim.type == STRUCTURE && victim.stattype == RESOURCE_EXTRACTOR){
		//of_wells[victim.x+'x'+victim.y]-=(of_fireDrain*60);
		if(of_wells[victim.x+'x'+victim.y])debugMsg("Destroy: "+victim.x+'x'+victim.y+':'+of_wells[victim.x+'x'+victim.y]);
		else debugMsg("Drain out: "+victim.x+'x'+victim.y);
//		debugMsg("Left: "+Object.keys(of_wells).length);
		of_burning[victim.x+'x'+victim.y]=of_burnTime;
/*		for(var o in of_wells){
			debugMsg(o+" "+of_wells[o]);
		}
*/		
	}
}

function of_eventChat(sender, to, message) {
	if(message == "of mod"){
		if(of_enabled){
			debugMsg("Oil Finite "+of_ver+" is enabled");
			console("Oil Finite "+of_ver+" is enabled");
		}
		else{
			debugMsg("Oil Finite "+of_ver+" is disabled");
			console("Oil Finite "+of_ver+" is disabled");
		}
	}
	
	if(message == "of enable"){
		if(of_enabled){
			debugMsg("Oil Finite "+of_ver+" already enabled");
			console("Oil Finite "+of_ver+" already enabled");
		}
		else {
			debugMsg("Oil Finite "+of_ver+" is enabled now");
			console("Oil Finite "+of_ver+" is enabled now");
			of_enabled = true;
			queue("of_inits", 1000);
		}
	}
	
	if(message == "of disable"){
		if(!of_enabled){
			debugMsg("Oil Finite "+of_ver+" already disabled");
			console("Oil Finite "+of_ver+" already disabled");
		}else{
			debugMsg("Oil Finite "+of_ver+" is disabled now");
			console("Oil Finite "+of_ver+" is disabled now");
			of_enabled = false;
			if(of_init){
				of_init=false;
				removeTimer("of_iterOils");
			}
		}
	}
}

function of_newWells(id, amount){
	if(!(typeof of_wells[id] !== 'undefined' && of_wells[id] !== null))debugMsg("oil new "+id+":"+amount);
	else debugMsg("oil renew "+id+":"+of_wells[id]+"->"+amount);
	if(of_burning[id])delete of_burning[id];
	of_wells[id] = amount;
}
//Функция сортирует массив по дистанции от заданного массива
//передаются параметры:
//arr - сортируемый массив
//obj - игровой объект в отношении чего сортируем массив
//num - кол-во возвращённых ближайших объектов
//reach - если задано, и если obj не может добраться на своём propulsion до arr[n], то из массива arr будут изъяты эти результаты
//если num не передан, возвращает полный сортированный массив
//если num равен 1, то всё равно возвращается массив но с единственным объектом
function sortByDistance(arr, obj, num, reach){
	if ( typeof reach === "undefined" ) reach = false;
	if ( typeof num === "undefined" || num == null || num == false) num = 0;
	else if ( arr.length == 1 ) num = 1;

	if ( num == 1 ) {

		var b = Infinity;
		var c = new Array();
		for ( var i in arr ) {
			if(reach)if(!droidCanReach(obj, arr[i].x, arr[i].y))continue;
			var a = distBetweenTwoPoints( obj.x, obj.y, arr[i].x, arr[i].y );
			if ( a < b ) {
				b = a;
				c[0] = arr[i];
			}
		}
		return c;
	}

	if ( num != 1 ) {
		arr.sort( function(a,b){
			if( distBetweenTwoPoints( obj.x, obj.y, a.x, a.y ) < distBetweenTwoPoints( obj.x, obj.y, b.x, b.y ) ) return -1;
			if( distBetweenTwoPoints( obj.x, obj.y, a.x, a.y ) > distBetweenTwoPoints( obj.x, obj.y, b.x, b.y ) ) return 1;
			return 0;
		});
	}

	if(reach){arr = arr.filter( function(e){
		if(!droidCanReach(obj,e.x,e.y)) return false;
		return true;
	});}
	
	if ( num == 0 ) return arr;

	if ( num >= arr.length ) num = (arr.length-1);
	
	return arr.slice(0,num);

}

function debugMsg(msg,level){
	var timeMsg = Math.floor(gameTime / 1000);
	debug("of["+timeMsg+"]: "+msg);
//	console(msg);
}
