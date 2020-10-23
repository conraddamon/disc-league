/*
 * Code to let the user sort the stats table. Very little error-checking is done.
 */

/**
 * @param ev browser click event
 * @param field override of field to use
 */
async function sortTable(ev, field, courseId, hcapMinRounds, hcapNumRounds, hcapRate) {

    field = field || ev.target.parentNode.id;
    // sort players by field
    var	players = sortPlayers(field),
	table = document.getElementById('statsTable');
    
    let handicapByPlayer = window.handicaps;
    if (!handicapByPlayer) {
	handicapByPlayer = window.handicaps = await calculateHandicaps(courseId, hcapMinRounds, hcapNumRounds, hcapRate);
    }
    const handicaps = { total: 0, num: 0 };

    var totalRounds = totalWinnings = totalUnpaid = 0;
    var averages = {};
    var bests = {};
    window.courseLayouts.forEach(layout => {
	    averages[layout] = { total: 0, num: 0 };
	    bests[layout] = { total: 0, num: 0 };
	});

    // remove all but the first row
    $('#statsTable').find("tr:gt(0)").remove();

    // re-layout table based on new sort order; table rows will be created if they don't exist (first time through)
    let rowNum = 0;
    for (var i = 0; i < players.length; i++) {

	var player = players[i],
	    p = window.playerData[player],
	    rounds = p.rounds,
	    hcap = handicapByPlayer[p.id],
	    hcapText = hcap != null ? hcap : '&nbsp;',
	    avg = p.average,
	    best = p.best,
	    row = table.rows[i + 1] || table.insertRow(),
	    html;

	if (!rounds) {
	    continue;
	}

	rowNum += 1;
	html = '<td>' + rowNum + '</td><td>' + player + '</td><td>' + rounds + '</td><td>' + hcapText + '</td><td>' + formatMoney(p.winnings) + '</td><td>' + formatMoney(p.unpaid) + '</td>';
        window.courseLayouts.forEach(layout => {
		html += '<td>' + (avg[layout] || ' ') + '</td>';
		html += '<td>' + (best[layout] || ' ') + '</td>';
		if (avg[layout]) {
		    averages[layout].total += avg[layout];
		    averages[layout].num++;
		}
		if (best[layout]) {
		    bests[layout].total += best[layout];
		    bests[layout].num++;
		}
	    });
	row.innerHTML = html;

	totalRounds += p.rounds;
	totalWinnings += p.winnings;
	totalUnpaid += p.unpaid;

	if (hcap) {
	    handicaps.total += hcap;
	    handicaps.num++;
	}
    }

    var avgHandicap = (handicaps.total / handicaps.num).toFixed(2);
    var avgMainAverage = (averages.main.total / averages.main.num).toFixed(2);
    var avgMainBest = (bests.main.total / bests.main.num).toFixed(2);
    var avgAltAverage = (averages.alternate.total / averages.alternate.num).toFixed(2);
    var avgAltBest = (bests.alternate.total / bests.alternate.num).toFixed(2);

    row = document.getElementById('totalRow');
    if (!row) {
	row = table.insertRow();
	row.id = 'totalRow';
	row.innerHTML = '<td></td><td>Total / Average</td><td>' + totalRounds + '</td><td>' + avgHandicap + '</td><td>' + formatMoney(totalWinnings) + '</td><td>' + formatMoney(totalUnpaid) + '</td><td>' + avgMainAverage + '</td><td>' + avgMainBest + '</td><td>' + avgAltAverage + '</td><td>' + avgAltBest + '</td>';
    }
}

/**
 * Sorts player stats on the given field.
 *
 * @param {String} field    column name to sort on
 */
function sortPlayers(field) {

    var players = Object.keys(window.playerData);

    if (field.indexOf('-') !== -1) {
	let parts = field.split('-');
	return players.sort(sortByLayoutValue(...parts));
    }

    switch(field) {
        case 'name': return players.sort(by_name);
        case 'handicap': return players.sort(by_handicap);
        case 'rounds':
        case 'winnings':
        case 'unpaid': 
        default: return players.sort(sortByValue(field));
    }
}

// Sorts by last name. No secondary key.
function by_name(a, b) {

    var nameA = a.split(" ").pop().toLowerCase(),
	nameB = b.split(" ").pop().toLowerCase();

    // use localeCompare() since Chrome is flaky if > is used
    return nameA.localeCompare(nameB);
}

// Sorts by Handicap from low to high.
function by_handicap(a, b) {

    var hcapA = parseFloat(window.handicaps[playerData[a].id]),
	hcapB = parseFloat(window.handicaps[playerData[b].id]);

    hcapA = isNaN(hcapA) ? 100 : hcapA;
    hcapB = isNaN(hcapB) ? 100 : hcapB;

    return hcapA != hcapB ? hcapA - hcapB : by_name(a, b);
}

// Returns a sort function for the given field, sorting from high to low.
function sortByValue(field) {

    return function(a, b) {

	var playerA = window.playerData[a],
	    playerB = window.playerData[b],
	    valueA = playerA[field],
	    valueB = playerB[field];

	return valueA != valueB ? valueB - valueA : by_name(a, b);
    }
}

// Returns a sort function for the given compound field (one that varies by layout), sorting from low to high.
function sortByLayoutValue(field, layout) {

    return function(a, b) {

	var playerA = window.playerData[a],
	    playerB = window.playerData[b],
	    valueA = playerA[field][layout] || 999,
	    valueB = playerB[field][layout] || 999;

	return valueA != valueB ? valueA - valueB : by_name(a, b);
    }
}
