/*
 * Code to let the user sort the weekly results table. Very little error-checking is done.
 */

/**
 * @param ev browser click event
 * @param field override of field to use
 */
async function sortTable(ev, field, courseId, weeklyId) {

    field = field || ev.target.parentNode.id;

    let playerData = window.playerData;
    if (!playerData) {
	playerData = window.playerData = {};
	const results = await sendRequestAsync('get-players', { courseId, weeklyId });
	results.forEach(result => playerData[result.id] = result);
    }

    let lowScore = window.lowScore;
    let lowScorers = window.lowScorers;

    let results = window.results;
    if (!results) {
	lowScore = 1000;
	lowScorers = [];
	results = window.results = await sendRequestAsync('get-results', { weeklyId });
	results.sort(by_score);
	results.forEach(result => {
		result.sortValue = (result.score == -1) ? 5000 : Number(result.adjusted_score);
		if (result.player_handicap == null) {
		    result.sortValue += 1000;
		}
		playerData[result.player_id].result = result;
		const score = Number(result.score);
		if (score !== -1 && score <= lowScore) {
		    lowScore = score;
		}
	    });

	results.sort((a, b) => a.sortValue - b.sortValue);
	let curSortValue = 0;
	let curPlace = 0;
	results.forEach((result, index) => {
		if (result.sortValue !== curSortValue) {
		    curPlace = index + 1;
		    curSortValue = result.sortValue;
		}
		result.place = curPlace;
		if (Number(result.score) === lowScore) {
		    lowScorers.push(playerData[result.player_id].name);
		}
	    });
	window.lowScore = lowScore;
	window.lowScorers = lowScorers;
    }


    // sort players by field
    const sortField = (field === 'player' && window.sortField === 'player') ? 'player-first' : field;
    var	players = sortPlayers(sortField),
	table = document.getElementById('resultsTable');

    window.sortField = (sortField === 'player-first') ? '' : sortField;

    // remove all but the first row
    $('#resultsTable').find("tr:gt(0)").remove();

    // re-layout table based on new sort order; table rows will be created if they don't exist (first time through)
    let rowNum = 0;
    for (var i = 0; i < players.length; i++) {

	var player = players[i],
	    p = window.playerData[player],
	    result = p.result,
            hcapText = result.score > 0 && result.player_handicap != null ? result.player_handicap : '&nbsp;',
	    scoreText = result.score == -1 ? 'NS' : result.score,
	    adjScoreText = result.score == -1 ? '&nbsp;' : result.adjusted_score,
	    prizeText = formatMoney(result.winnings) + (result.winnings > 0 && result.paid == 0 ? '*' : ''),
	    row = table.rows[i + 1] || table.insertRow(),
	    html;

	rowNum += 1;
	html = '<td>' + ( i + 1) + '</td><td>' + result.place + '</td><td>' + p.name + '</td><td>' + scoreText + '</td><td>' + hcapText + '</td><td>' + adjScoreText + '</td><td>' + prizeText + '</td>';
	row.innerHTML = html;
    }

    $('#low_score').text(lowScore);
    $('#low_scorers').text(lowScorers.join(', '));
}

/**
 * Sorts player stats on the given field.
 *
 * @param {String} field    column name to sort on
 */
function sortPlayers(field) {

    var players = Object.keys(window.playerData);

    switch(field) {
        case 'player': return players.sort(by_name);
        case 'player-first': return players.sort(by_first_name);
        case 'raw-score': return players.sort(sortByValue('score', false, true));
        case 'score': return players.sort(sortByValue('adjusted_score', false, true));
        case 'place': return players.sort(sortByValue('place', false));
        case 'handicap': return players.sort(sortByValue('player_handicap', false));
        case 'prize': return players.sort(sortByValue('winnings', true));
    }
}

// Sorts by last name. No secondary key.
function by_name(a, b) {

    var nameA = window.playerData[a].name.split(" ").pop().toLowerCase(),
	nameB = window.playerData[b].name.split(" ").pop().toLowerCase();

    // use localeCompare() since Chrome is flaky if > is used
    return nameA.localeCompare(nameB);
}

// Sorts by first name, with the next name as secondary key.
function by_first_name(a, b) {

    var namesA = window.playerData[a].name.split(" "),
	namesB = window.playerData[b].name.split(" "),
	firstA = namesA[0].toLowerCase(),
	firstB = namesB[0].toLowerCase(),
	secondA = namesA[1] ? namesA[1].toLowerCase() : '',
	secondB = namesB[1] ? namesB[1].toLowerCase() : '';

    var result = firstA.localeCompare(firstB);

    // use localeCompare() since Chrome is flaky if > is used
    return result !== 0 ? result : secondA.localeCompare(secondB);
}

// Returns a sort function for the given field, sorting from high to low.
function sortByValue(field, descending, isScore) {

    return function(a, b) {

	var playerA = window.playerData[a],
	    playerB = window.playerData[b],
	    valueA = playerA.result[field] || 0,
	    valueB = playerB.result[field] || 0;

	if (isScore) {
	    valueA = (playerA.result.score == -1) ? 5000 : valueA;
	    valueB = (playerB.result.score == -1) ? 5000 : valueB;
	}

	if (field === 'player_handicap') {
	    valueA = valueA || 1000;
	    valueB = valueB || 1000;
	}

	if (descending) {
	    return valueA != valueB ? valueB - valueA : by_name(a, b);
	}

	return valueA != valueB ? valueA - valueB : by_name(a, b);
    }
}

function by_score(a, b) {

    const adjA = (a.score == -1 ? 5000 : Number(a.adjusted_score));
    const adjB = (b.score == -1 ? 5000 : Number(b.adjusted_score));
    const testA = (a.player_handicap != null) ? adjA : 1000 + adjA;
    const testB = (b.player_handicap != null) ? adjB : 1000 + adjB;

    if (testA == testB) {
	return 0;
    }
    return testA - testB;
}
