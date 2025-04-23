/*
 * Code to let the user sort the stats table. Very little error-checking is done.
 */

/**
 * @param ev browser click event
 * @param field override of field to use
 */
async function sortTable(ev, field) {

    field = field || ev.target.parentNode.id;
    window.isReverseSort = (field === window.currentSortField) ? !window.isReverseSort : false;
    window.currentSortField = field;

    // sort players by field
    const players = sortPlayers(field);
    const table = document.getElementById('statsTable');

    let handicapByPlayer = window.handicaps;
    const cd = window.courseData;
    if (!handicapByPlayer) {
	handicapByPlayer = window.handicaps = await calculateHandicaps(cd.id, cd.handicap_min_rounds, cd.handicap_num_rounds, cd.handicap_rate, cd.handicap_base, cd.parMap);
    }
    const handicaps = { total: 0, num: 0 };
    const averages = { total: 0, num: 0 };
    const bests = { total: 0, num: 0 };

    let totalRounds = totalWinnings = totalUnpaid = 0;

    // remove all but the first row
    $('#statsTable').find("tr:gt(0)").remove();

    // re-layout table based on new sort order; table rows will be created if they don't exist (first time through)
    let rowNum = 0;
    for (let i = 0; i < players.length; i++) {

	var playerId = players[i],
	    p = window.playerData[playerId],
	    player = p.player,
	    rounds = p.rounds,
	    low = p.low,
	    hcap = handicapByPlayer[playerId],
	    hcapText = hcap != null ? hcap : '',
	    avg = p.average || 0,
	    avgText = avg || '',
	    best = p.best || 0,
	    bestText = best || '',
	    row = table.rows[i + 1] || table.insertRow(),
	    html;

	if (!rounds) {
	    continue;
	}

	rowNum += 1;
	html = '<td>' + rowNum + '</td><td>' + player + '</td><td>' + rounds + '</td><td>' + low + '</td><td>' + hcapText + '</td><td>' + formatMoney(p.winnings) + '</td><td>' + formatMoney(p.unpaid) + '</td><td>' + avgText + '</td><td>' + bestText + '</td>';
	if (avg) {
	    averages.total += avg;
	    averages.num++;
	}
	if (best) {
	    bests.total += best;
	    bests.num++;
	}
	row.innerHTML = html;

	totalRounds += p.rounds;
	totalWinnings += p.winnings;
	totalUnpaid += p.unpaid;

	if (hcap) {
	    handicaps.total += Number(hcap);
	    handicaps.num++;
	}
    }

    var avgHandicap = handicaps.num ? (handicaps.total / handicaps.num).toFixed(2) : '';
    var avgAverage = (averages.total / averages.num).toFixed(2);
    var avgBest = (bests.total / bests.num).toFixed(2);

    row = document.getElementById('totalRow');
    if (!row) {
	row = table.insertRow();
	row.id = 'totalRow';
	row.innerHTML = '<td></td><td>Total / Average</td><td>' + totalRounds + '</td><td></td><td>' + avgHandicap + '</td><td>' + formatMoney(totalWinnings) + '</td><td>' + formatMoney(totalUnpaid) + '</td><td>' + avgAverage + '</td><td>' + avgBest + '</td>';
    }
}

/**
 * Sorts player stats on the given field.
 *
 * @param {String} field    column name to sort on
 */
function sortPlayers(field) {

    var playerIds = Object.keys(window.playerData);

    switch(field) {
        case 'name': return playerIds.sort(by_name);
        case 'handicap': return playerIds.sort(by_handicap);
        case 'average':
        case 'best': return playerIds.sort(sortByValue(field)).reverse();
        case 'rounds':
        case 'low':
        case 'winnings':
        case 'unpaid': 
        default: return playerIds.sort(sortByValue(field));
    }
}

// Sorts by last name. No secondary key.
function by_name(a, b) {

    var playerA = window.playerData[a],
	playerB = window.playerData[b];
    var nameA = playerA.player.split(" ").pop().toLowerCase(),
	nameB = playerB.player.split(" ").pop().toLowerCase();

    // use localeCompare() since Chrome is flaky if > is used
    return nameA.localeCompare(nameB);
}

// Sorts by Handicap from low to high.
function by_handicap(a, b) {

    var hcapA = parseFloat(window.handicaps[a]),
	hcapB = parseFloat(window.handicaps[b]);

    if (isNaN(hcapA) || isNaN(hcapB)) {
	return isNaN(hcapA) && isNaN(hcapB) ? by_name(a, b) : isNaN(hcapA) ? 1 : -1;
    }

    if (window.isReverseSort) {
	return hcapA != hcapB ? hcapB - hcapA : by_name(a, b);
    }

    return hcapA != hcapB ? hcapA - hcapB : by_name(a, b);
}

// Returns a sort function for the given field, sorting from high to low.
function sortByValue(field) {

    return function(a, b) {

	var playerA = window.playerData[a],
	    playerB = window.playerData[b],
	    valueA = playerA[field] || 0,
	    valueB = playerB[field] || 0;

	if (valueA == null || valueB == null) {
	    return !valueA && !valueB ? by_name(a, b) : !valueA ? -1 : 1;
	}

	if (window.isReverseSort) {
	    return valueA != valueB ? valueA - valueB : by_name(a, b);
	}

	return valueA != valueB ? valueB - valueA : by_name(a, b);
    }
}

async function showBonusPots(courseId) {

    const potCap = { ace: 500, eagle: 150 };
    const hitsResult = await sendRequestAsync('get-aces-eagles', { courseId });
    const bonusInfo = {};
    const bonusPot = {};
    const types = ['ace', 'eagle'];
    for (let i = 0; i < types.length; i++) {
	const type = types[i];
	const entry = Number(window.courseData[type]);
	const initialPot = Number(window.courseData['initial_' + type]);
	let start = 0;
	let forward = 0;
	bonusInfo[type] = [];
	const hits = hitsResult.filter(res => !!res[type]);
	const hitsByWeekly = {};
	for (let j = 0; j < hits.length; j++) {
	    const hit = hits[j];
	    const weekly = Number(hit.weekly_id);
	    if (!hitsByWeekly[weekly]) {
		hitsByWeekly[weekly] = [];
	    }
	    const holes = hit[type].split(',');
	    holes.forEach(hole => {
		const newHit = { ...hit };
		newHit.hole = Number(hole);
		hitsByWeekly[weekly].push(newHit);
	    });
	}
	const weeklies = Object.keys(hitsByWeekly);
	for (let j = 0; j < weeklies.length; j++) {
	    const weekly = Number(weeklies[j]);
	    const hits = hitsByWeekly[weekly];
	    let prize = 0;
	    let cap = 10000;
	    const end = weekly;
	    if (type === 'ace' || end > 200) {
		cap = potCap[type];
	    }
	    if (start === 0 && initialPot > 0) {
		prize = initialPot;
	    } else {
		const numRounds = await sendRequestAsync('get-rounds', { courseId, startWeekly: start, endWeekly: end });
		prize = forward + (numRounds * entry);
		if (prize > cap) {
		    forward = prize - cap;
		    prize = cap;
		} else {
		    forward = 0;
		}
	    }
	    start = end;
	    const prizePerHit = prize / hits.length;
	    for (let k = 0; k < hits.length; k++) {
		const hit = hits[k];
		bonusInfo[type].push({ hole: hit.hole, player: hit.player_id, weekly, date: hit.date, prize: prizePerHit });
	    }
	}
	const numRounds = await sendRequestAsync('get-rounds', { courseId, startWeekly: start });
	const cap = potCap[type];
	bonusPot[type] = {};
	let prize = forward + (numRounds * entry);
	let next = 0;
	if (prize > cap) {
	    next = prize - cap;
	    prize = cap;
	}
	bonusPot[type].pot = prize;
	bonusPot[type].next = next;
    }

    types.forEach(type => {
	const html = [];
	const next = bonusPot[type].next ? ` (capped, ${formatMoney(bonusPot[type].next)} carries over)` : '';
	html.push("<div class='pot'>");
	html.push(`Pot: ${formatMoney(bonusPot[type].pot)}${next}`);
	html.push('</div>');
	const hits = bonusInfo[type].sort((a, b) => b.weekly - a.weekly);
	hits.forEach(hit => {
	    html.push("<div class='bonus'>");
	    html.push(`#${hit.hole} by ${window.playerData[hit.player].player} for ${formatMoney(hit.prize)} on <a href='weekly.html?id=${hit.weekly}'>${fromMysqlDate(hit.date).toLocaleDateString('en-us', {month: 'short', day: 'numeric', year: 'numeric'})}</a>`);
	    html.push('</div>');
	});
	const el = document.getElementById(`${type}Section`);
	if (el) {
	    el.innerHTML = html.join('\n');
	}
    });
}

// Grabs records for the given layout as well as players' average and best scores, then
// repopulates the table.
async function handleLayoutChange(courseId, layout) {

    $('#currentLayout').text(layout);
    let result = await sendRequestAsync('get-record', { courseId, layout });
    const score = result && result[0] && result[0].score;
    if (score > 0) {
	result = await sendRequestAsync('get-record-holders', { courseId, layout, score });
	const records = result.map(res => {
		const player = window.playerData[Number(res.player_id)].player;
		return player + ' on ' + fromMysqlDate(res.date).toLocaleDateString();
	    });
	$('#layoutRecord').text(' ' + score + ' by ' + records.join(', '));
    }

    const keys = Object.keys(window.playerData);
    keys.forEach(p => window.playerData[p].average = undefined);
    result = await sendRequestAsync('get-average-scores', { courseId, layout });
    result.forEach(res => window.playerData[Number(res.player_id)].average = Number(res.average));
    keys.forEach(p => window.playerData[p].best = undefined);
    result = await sendRequestAsync('get-best-scores', { courseId, layout });
    result.forEach(res => window.playerData[Number(res.player_id)].best = Number(res.best));
    sortTable(null, 'name');
    //showBonusPots(courseId);
}
