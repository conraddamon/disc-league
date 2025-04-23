/* Common functions to help with Disc Golf Weekly management */

/**
 * Loads course data.
 *
 * @param {Function} callback    Function to call with results
 * @param {String}   courseId    (optional) ID of course to fetch
 */
function getCourse(callback, courseId) {

    sendMessage('load-course', callback, { courseId: courseId });
}

/**
 * Gets player data so we can use the names for autocomplete.
 *
 * @param {Function} callback    Function to call with results
 */
function getPlayer(callback) {

    sendMessage('load-player', callback);
}

/**
 * When the password field loses focus, check the password. Alert the user if it's wrong.
 *
 * @param {Event} e    Browser event
 */
function passwordBlurHandler(e) {

    var pwField = $('#password');
    sendRequest('check-password', { pw: pwField.val(), courseId: window.currentCourse }, function(good) {
	    if (good) {
		pwField.removeClass('invalid');
	    }
	    else {
		pwField.addClass('invalid');
	    }
	});
}

async function calculateHandicaps(courseId, hcapMinRounds, hcapNumRounds, hcapRate, hcapBase, parMap, weeklyId) {
    
    const parData = await sendRequestAsync('get-pars', { courseId }) || [];
    const pars = {};
    parData.forEach(parRow => {
	    if (hcapBase === 'par') {
		pars[parRow.id] = parRow.layout === 'custom' ? Number(parRow.custom_par) : parMap[parRow.layout];
	    } else {
		pars[parRow.id] =  parRow.par;
	    }
	});

    const scores = await sendRequestAsync('get-scores', { weeklyId, courseId }) || [];
    const scoresByPlayer = {};
    scores.forEach(scoreRow => {
	    scoresByPlayer[scoreRow.player_id] = scoresByPlayer[scoreRow.player_id] || [];
	    const playerScores = scoresByPlayer[scoreRow.player_id];
	    if (playerScores.length < hcapNumRounds) {
		playerScores.push(scoreRow);
	    }
	});

    const playerIds = Object.keys(scoresByPlayer);
    const totalDelta = {};
    playerIds.forEach(playerId => {
	    totalDelta[playerId] = scoresByPlayer[playerId].reduce((acc, scoreRow) => acc + (scoreRow.score - pars[scoreRow.weekly_id]), 0);
	});

    const handicap = {};
    playerIds.forEach(playerId => {
	    const numScores = scoresByPlayer[playerId].length;
	    if (numScores >= hcapMinRounds) {
		handicap[playerId] = ((hcapRate / 100) * (totalDelta[playerId] / numScores)).toFixed(2);
	    }
	});

    return handicap;
}
