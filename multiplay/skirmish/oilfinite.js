//Mod: Oil Finite (of)
//By EuPhobos
//License CC-0
var of_ver = "v1.00"
/*

v1.00
Initial release
Почти всё задуманное - работает.

Проблема 1:
Невозможно получить состояние нефтевышки (качает/простаивает)
Поэтому построенные нефтевышки начинают уменьшать кол-во нефти, даже если не хватает генераторов.

Проблема 2:
Невозможно получить состояние горения нефтеточки (не страшно)
Так как нет способов раньше времени потушить горение нефти,
То просто в момент взрыва нефтевышки, высчитываем горение нефти + время горения

*/


//Рандомное появление новых месторождений на карте
//var of_oilSpawn = false;

//Количество нефти в стартовых месторождениях занятых игроком
//Amount of oil on the oilwells occupied by player from start of the game
var of_amountOil = 600;

//Количество нефти в стартовых месторождениях не занятых игроком
//Amount of oil on the free oilwells
var of_amountFreeOil = 900;

//Количество нефти в новых месторождениях
//var of_amountNewOil = Math.round(of_amountOil/2);

//Истощение точки в секунду при удержании мусорщиками
//Pumping oil by scavengers in game second
var of_scavDrain = 0.25;

//Истощение точки в секунду при удержании игроком/ботом
//Pumping oil by player/bots in game second
var of_playerDrain = 1;

//Иссыхание свободной точки в секунду (по умолчанию нет)
//Drying of an unoccupied oil rig (not allowed by default)
var of_freeDrain = 0;

//Горение нефти в секунду
//Buring out oil
var of_fireDrain = 5;


//Массив скважен
var of_wells = {};

var of_init = false;

function of_getOils(){
	var of_scavengerPlayer = (scavengers) ? Math.max(7,maxPlayers) : -1;

	var of_allResources = enumFeature(ALL_PLAYERS, "OilResource");
	
	for ( var e = 0; e < maxPlayers; ++e ) of_allResources = of_allResources.concat(enumStruct(e,RESOURCE_EXTRACTOR));

	if(scavengers == true){
		of_allResources = of_allResources.concat(enumStruct(of_scavengerPlayer, "A0ResourceExtractor"));
	}

	if(!of_init){
		of_init = true;
		debugMsg("Mod Running: Oil Finite "+of_ver);
		debugMsg("Finite oil wells: "+of_allResources.length);
	}
	
//	debugMsg(JSON.stringify(getObject(17,23)));
//	debugMsg(structureIdle(getObject(17,23)));
	
	for (var of_o in of_allResources){
			var of_oil = of_allResources[of_o];
			var of_idOil = of_oil.x+"x"+of_oil.y;

			//Если данная точка отсуствует в массиве, назначаем начальную стоимость
			if(!(typeof of_wells[of_idOil] !== 'undefined' && of_wells[of_idOil] !== null)){
				if(getObject(of_oil.x, of_oil.y).player == 12) of_wells[of_idOil] = of_amountFreeOil;
				else of_wells[of_idOil] = of_amountOil;
			}
			
			switch(of_oil.player) {
				case of_scavengerPlayer:
					of_wells[of_idOil]-=of_scavDrain;
					break;
				case 12:
					of_wells[of_idOil]-=of_freeDrain;
					break;
				default:
					if(of_oil.status == BUILT)
					of_wells[of_idOil]-=of_playerDrain;
			}
			
			if(of_wells[of_idOil] <= 0){
				if(of_oil.player != 12){
					removeObject(of_allResources[of_o], true);
					removeObject(getObject(of_oil.x, of_oil.y), false);
				}else{
					removeObject(of_allResources[of_o], true);
				}
				delete of_wells[of_idOil];
			}
//			debugMsg("Oil: player="+of_oil.player+" ("+of_oil.x+"x"+of_oil.y+") - "+of_wells[of_idOil]);
	}

}

setTimer("of_getOils", 1000);


function eventDestroyed(victim) {
	if (victim.player === selectedPlayer)
	{
		reticuleUpdate(victim, DESTROY_LIKE_EVENT);
	}
	
	//Высчитываем горение нефти
	if(victim.type == STRUCTURE && victim.stattype == RESOURCE_EXTRACTOR){
		of_wells[victim.x+'x'+victim.y]-=(of_fireDrain*60);
	}
}


function debugMsg(msg,level){
	var timeMsg = Math.floor(gameTime / 1000);
	debug("of["+timeMsg+"]: "+msg);
	console(msg);
}
