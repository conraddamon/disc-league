/*
 * Functions for the results form (results.html).
 */

/**
 * Sets up key handlers, adds a date picker, and sets up form submission.
 */
async function initializeResults() {

    // handle Enter key
    $(':text').on('keypress keydown keyup', keyHandler);
    $('#bulkEntry').on('keypress keydown keyup', keyHandler);
    $('#playerData').on('keypress keydown keyup', keyHandler);

    // hide results header to start
    $('#playerDataHeader').hide();

    // use jQuery's mini-calendar
    $('#date').datepicker({
	    dateFormat: "M d, yy",
	    onSelect: function(date) {
		updateTitle(date);
	    }
	});

    // check password on blur
    $('#password').blur(passwordBlurHandler);

    $('#manualHandicaps').change(handleManualHandicaps);
    $('#enableBulkEntry').change(handleEnableBulkEntry);
    $('#layout').change(handleLayoutChange);
    $('#customLayout').on('paste', handleLayoutPaste);

    // we handle form submit
    $('#submitButton').click(submitResults);

    // assume we've started handicaps
    window.handicapping = true;

    // remember query string args
    window.qs = parseQueryString();
    window.currentCourse = window.qs.id || window.qs.courseId;

//    window.parData = await sendRequestAsync('get-pars', { courseId: window.currentCourse });
//    window.scores = await sendRequestAsync('get-scores', { weeklyId: window.qs.weeklyId, courseId: window.currentCourse });

    // fetch data
    const courseData = await sendRequestAsync('load-course');
    handleCourseInfo(courseData);
    const playerData = await sendRequestAsync('load-player');
    handlePlayerInfo(playerData);
}

/**
 * Updates the title and the page header to show the course and date.
 *
 * @param {String} date    Date of weekly
 */
function updateTitle(date) {

    var course = window.courseData[window.currentCourse].name,
	title = "Weekly results for " + course + (date ? " on " + date : "");

    $('.title').text(title);
}

/**
 * Handles use of the Enter key. If it happens in the Score field, we add a row for the player.
 * If it happens in a prize money box, we update the total.
 *
 * @param {Event} e    Browser event
 */
function keyHandler(e) {

    if (e.keyCode === 13) {
	if (e.type === 'keyup') {
	    if (e.target.id === 'score' || e.target.id === 'handicap') {
		addScore();
	    }
	    else if (e.target.id === 'player') {
		$('#score').focus();
	    }
	    else if (e.target.id === 'bulkEntry') {
		processBulkEntry();
	    }
	    else if ($(e.target).hasClass('prize')) {
		updateTotal();
		$(e.target).parent().parent().next().find('.prize').focus();
	    }
	}
	e.preventDefault();
    }
}

function handleManualHandicaps(e) {

    var on = !!$("input[name='manualHandicaps']:checked").val();
    if (on) {
	$('#handicapContainer').show();
    }
    else {
	$('#handicapContainer').hide();
	$('#handicap').val('');
    }
}

function handleEnableBulkEntry(e) {

    var on = !!$("input[name='enableBulkEntry']:checked").val();
    if (on) {
	$('#bulkEntryContainer').show();
    }
    else {
	$('#bulkEntryContainer').hide();
    }
}

function handleLayoutChange(e) {
    const layout = e.target.value;
    if (layout === 'custom') {
	$('#customLayoutContainer').show();
    } else {
	$('#customLayoutContainer').hide();
    }
}

function parseUdiscLayout(text) {

    text = text.replace(/['"]/g, '');
    const lines = text.split('\n').filter(line => /\S+/.test(line));
    let layout = lines[0];
    let layoutPar = 0;
    if (lines.length > 1) {
	const holes = [];
	lines.forEach(line => {
	    const parts = line.split('\t');
	    const hole = parts[0];
	    const star = /^\d+$/.test(hole) ? '' : '*';
	    const par = Number(parts[1]);
	    layoutPar += par;
	    const tee = parts[2][0];
	    const pin = parts[3];
	    const holePar = (par === 3) ? '' : par;
	    holes.push(tee + pin + holePar + star);
	});
	layout = holes.join(',');
    } else {
	layoutPar = layout.split(',').reduce((acc, hole) => acc + (parseInt(hole.slice(-1)) || 3), 0);
    }

    $('#customLayout').val(layout);
    $('#customPar').val(layoutPar);
}

function handleLayoutPaste(e) {
    setTimeout(() => parseUdiscLayout($('#customLayout').val()));
}

/**
 * Stores course data in a global window variable.
 *
 * @param {Object} data    Course data from db
 */
async function handleCourseInfo(data) {

    // Change current course when user picks a different course
    $('#course').on('change', onCourseSelected);

    var courseToSelect = window.qs.courseId || window.qs.id || 1,
	isTest = window.qs.test,
	cd = window.courseData = {}; // global storage for course data

    for (var i = 0; i < data.length; i++) {
	var course = data[i];
	var option = new Option(course.name, course.id);
	cd[course.id] = course;
	$('#course').append($(option));
    }

    // select first course by default
    $('#course option[value=' + courseToSelect + ']').prop('selected', true);
    onCourseSelected(null, courseToSelect);
}

/**
 * Sets up the autocompleter now that we have all the known player names.
 *
 * @param {Object} data    Player data from db
 */
async function handlePlayerInfo(data) {

    saveNames(data);
    addNameAutocomplete(getNameList(data));
    window.paypal = {};
    data.forEach(person => {
	    if (person.paypal) {
		window.paypal[person.id] = person.paypal;
	    }
	});

    if (window.qs.weeklyId) {
	window.editMode = true;
	const weeklyData = await sendRequestAsync('get-weekly',  { weeklyId: window.qs.weeklyId });
	gotWeekly(weeklyData);
	const resultData = await sendRequestAsync('get-results', { weeklyId: window.qs.weeklyId });
	gotResults(resultData);
    }
}

/**
 * Updates the displayed course information, including available layouts (if more than one), entry, and
 * prize information.
 *
 * @param {Event} e    Browser event
 * @param {int} value  [optional] course ID to force selection
 */
async function onCourseSelected(e, value) {

    value = value || this.value;

    var showLayouts = false,
	course = window.courseData[value];

    window.currentCourse = course.id;
    
    var defaultLayout = course.id === '1' ? 'custom' : undefined;

    updateTitle();

    // re-create the layouts select dropdown
    $('#layout option').remove();
    var layoutStr = course.layouts || '',
	layouts = layoutStr.split(/[\s,]+/);
    // create a select if there are multiple layouts
    if (layouts && layouts.length > 1) {
	for (var j = 0; j < layouts.length; j++) {
	    var layout = layouts[j];
    	    var isDefault = (layout === defaultLayout);
	    var option = new Option(layout, layout, isDefault, isDefault);
	    $('#layout').append($(option));
	}
	showLayouts = true;
    }
    $('#layoutContainer').css('display', showLayouts ? 'inline-block' : 'none');
    if (defaultLayout === 'custom') {
	$('#customLayoutContainer').show();
    } else {
	$('#customLayoutContainer').hide();
    }

    // show entry and prize info
    var moneyText = [], money = [];
    if (course.entry) {
	$('#courseEntry').text("Entry fee: " + formatMoney(course.entry));
	if (course.prize && course.prize != course.entry) {
	    moneyText.push('Prize');
	    money.push(formatMoney(course.prize));
	}
    }

    // show ace and eagle columns if appropriate
    var aceText = '', eagleText = '';
    if (course.ace > 0) {
	$('.ace').show();
	moneyText.push('Ace');
	money.push(formatMoney(course.ace));
    }
    else {
	$('.ace').hide();
    }
    if (course.eagle > 0) {
	$('.eagle').show();
	moneyText.push('Eagle');
	money.push(formatMoney(course.eagle));
    }
    else {
	$('.eagle').hide();
    }
    
    // show where entry fees go
    if (money.length) {
	$('#courseMoney').text(moneyText.join(' / ') + " money per entry: " + money.join(' / '));
    }

    const parMap = {};
    const pars = course.pars.split(/\s*,\s*/);
    course.layouts.split(/\s*,\s*/).forEach((layout, index) => parMap[layout] = Number(pars[index]));

    // get handicaps
    window.handicaps = await calculateHandicaps(course.id, course.handicap_min_rounds, course.handicap_num_rounds, course.handicap_rate, course.handicap_base, parMap, window.qs.weeklyId);

    // find out how many weeklies this course has had (to know whether handicapping is in effect)
    if (course.numWeeklies == null) {
	getNumWeeklies(handleNumWeeklies);
    }
}

/**
 * Fetches the number of weeklies held at the given course
 *
 * @param {Function} callback    Function to call with results
 */
async function getNumWeeklies( callback) {

    callback = callback.bind(null, window.currentCourse);
    const data = await sendRequestAsync('get-num-weeklies', { courseId: window.currentCourse });
    callback(data);
}

/**
 * Stores the number of weeklies for the given course. There is a small chance of a race condition,
 * where the user could start entering player scores before this is called, so that we don't know
 * if handicapping is in effect. For that reason, we default handicapping to true during initialization.

 * @param {Function} callback    Function to call with results
 */
async function handleNumWeeklies(courseId, numWeeklies) {

    var course = window.courseData[courseId];

    course.numWeeklies = numWeeklies;
    window.handicapping = !window.qs.noHandicaps && numWeeklies >= (course.handicap_start - 1);
    if (window.handicapping) {
	$('#headerScoreRaw').text('Score (raw)');
	$('#headerScoreAdj').show();
	$('#headerHandicap').show();
    }
    else {
	$('#headerScoreRaw').text('Score');
	$('#headerScoreAdj').hide();
	$('#headerHandicap').hide();
    }
}

/**
 * Starts the process of adding a player data row to the table. If the player is new, add them.
 */
async function addScore(player, score) {

    player = capitalizeName(player || $('#player').val());
    score = score || $('#score').val();

    if (!$.isNumeric(score)) {
	return;
    }

    if (!window.personId[player]) {
	const playerId = await sendRequestAsync('add-player', { player });
	window.personData[playerId] = { name: player };
	window.personId[player] = playerId;
    }

    showScore(player, score);
}

/**
 * Adds a row to the table of player scores. Calculates and shows the adjusted score.
 *
 * @param {string}   player      Player name
 * @param {string}   score       Player score
 * @param {string}   handicap    Player handicap
 */
function showScore(player, score, handicap) {

    score = Number(score);

    const id = window.personId[player];
    const p = window.personData[id];
    handicap = handicap || (window.handicaps ? window.handicaps[id] : undefined);

    var manualHandicap = $('#handicap').val();
    if (manualHandicap) {
	handicap = Number(manualHandicap);
    }

    const adjScore = handicap != null && !isNaN(handicap) ? Math.round((score - Number(handicap)) * 100) / 100 : score;
    
    // update data
    p.handicap = handicap;
    p.manualHandicap = !!manualHandicap;
    p.score = score;
    p.adjScore = adjScore;

    // show the header
    $('#playerDataHeader').show();

    // add a row to the list of player rounds
    addPlayerElement(id, player, score, handicap, adjScore);

    // reset form fields
    $('#player').val('');
    $('#score').val('');
    $('#handicap').val('');
    $('#player').focus();

    // recalculate total prize money
    updateTotal();
}

/**
 * Updates the total prize money and how much remains to be paid.
 */
function updateTotal() {

    // total is number of players times prize money per player
    var total = $('#playerData li').length * window.courseData[window.currentCourse].prize,
	paid = 0;

    // sum the prize money awarded
    $('.prize').each(function() {
	    paid = paid + Number($(this).val());
	});

    // update course info
    $('#coursePurse').text("Purse: " + formatMoney(total));
    total = total - paid;
    $('#courseRemainingPayout').text("Remaining Payout: " + formatMoney(total, true));
}

/**
 * Adds a row for the player's round in the weekly. Results are sorted by adjusted score, and players
 * with handicaps come first.
 *
 * @param {int}    id       Player ID
 * @param {String} player   Player name
 * @param {int}    score    Player score
 * @param {int}    handicap Player handicap
 * @param {int}    adjScore Adjusted score
 */
function addPlayerElement(id, player, score, handicap, adjScore) {

    var course = window.courseData[window.currentCourse],
	score1 = (score == -1) ? 'DNF' : score,
	adjScore1 = (score == -1) ? 'DNF' : adjScore.toFixed(2),
	handicap1 = (score != -1 && handicap != null) ? handicap : ' ';

    const el = $('li[data-playerid="' + id + '"]');
    if (el) {
	el.remove();
    }
    var index = getPlayerSortIndex(id);

    var ace = (course.ace > 0) ? "<div class='dataCell'><input type='text' class='ace' /></div>" : '',
        eagle = (course.eagle > 0) ? "<div class='dataCell'><input type='text' class='eagle' /></div>" : '';

    var handicapHtml = window.handicapping ? "<div class='dataCell playerHandicap'>" + handicap1 + "</div>" : '',
	adjScoreHtml = window.handicapping ? "<div class='dataCell playerAdjScore'>" + adjScore1 + "</div>" : '';
    
    var html = "<li data-playerid='" + id + "'><div class='playerName'>" + player + "</div><div class='dataCell playerScore'>" + score1 + "</div>" + handicapHtml + adjScoreHtml + "<div class='dataCell'><input type='text' class='prize' /></div><div class='dataCell'><input type='checkbox' class='paid' value='1' /></div>" + ace + eagle + "<div class='dataCell'><div class=' imgTrash' onclick='removeRow(event);'></div></div><div class='dataCell pay'></div></li>";

    // insert row at sort index - why doesn't jquery have insert at index?
    if (index === 0) {
	$('#playerData').prepend(html);
    }
    else if (index === -1) {
	$('#playerData').append(html);
    }
    else {
	$('#playerData').children().eq(index - 1).after(html);
    }

    updatePayout();
}

/**
 * Removes the row containing the clicked trash icon.
 *
 * @param {Event} e    Browser event
 */
function removeRow(e) {

    $(e.target).closest('li').remove();
    updatePayout();
}

/**
 * Returns the sort index for the player with the given ID. Players with handicaps come first, then it's
 * by adjusted score.
 *
 * @param {int}    id       Player ID
 *
 * @return {int} sort index
 */
function getPlayerSortIndex(id) {

    var index = -1;
    var p1 = window.personData[id],
	p1a = p1.score == -1 ? 5000 : parseFloat(p1.adjScore),
	p1test = p1.handicap != null ? p1a : p1a + 1000;

    $('li[data-playerid]').each(function(idx, el) {
	    var playerId = el.dataset.playerid,
		p2 = window.personData[playerId],
		p2a = p2.score == -1 ? 5000 : parseFloat(p2.adjScore),
		p2test = p2.handicap != null ? p2a : p2a + 1000;
	    
	    if (p1test < p2test) {
		index = idx;
		return false;
	    }
	});

    return index;
}

// Update the payout any time a score is added or removed. The players are already sorted by
// adjusted score.
function updatePayout() {

    let numPlayers = 0;
    let numPayablePlayers = 0;
    const playerIds = [];
    $('li[data-playerid]').each(function(idx, el) {
	    let playerId = el.dataset.playerid;
	    let player = window.personData[playerId];
	    numPlayers++;
	    playerIds.push(playerId);
	    if (player.score > 0 && player.handicap != null) {
		numPayablePlayers++;
	    }
	});

    if (playerIds.length === 0) {
	return;
    }

    const entry = parseFloat(window.courseData[window.currentCourse].prize);
    const coefficient = 2;
    // pay top third (at least one), and only players with handicaps
    if (numPayablePlayers === 0) {
	numPayablePlayers = numPlayers;
    }
    const paidPlaceCount = Math.max(Math.min(Math.round(numPlayers / 3), numPayablePlayers), 1);
    const pool = entry * numPlayers;
    const factor = 1 + (coefficient / paidPlaceCount);

    const sharesByPlace = [];
    let totalShares = 0;
    for (let i = 0; i < paidPlaceCount; i++) {
	const share = factor ** (paidPlaceCount - i);
	sharesByPlace[i] = share;
	totalShares += share;
    }

    const shareFraction = 1 / totalShares;
    const shareValue = shareFraction * pool;
    const payoutsByPlace = [];
    let totalPayout = 0;

    for (let i = 0; i < paidPlaceCount; i++) {
	let payout = sharesByPlace[i] * shareValue;
	payout = Math.round(payout * 100) / 100; // round to nearest cent
	payoutsByPlace[i] = payout;
	totalPayout += payout;
    }

    const roundingError = pool - totalPayout;
    if (roundingError > 0) {
	payoutsByPlace[0] += roundingError;
    } else {
	payoutsByPlace[payoutsByPlace.length - 1] += roundingError;
    }

    $('li[data-playerid] .prize').val(''); // clear payouts
    $('li[data-playerid] .pay').html(''); // clear pay links/text
    payoutsByPlace.forEach((payout, index) => {
	    const prize = payout.toFixed(2);
	    const playerId = playerIds[index];
	    window.personData[playerId].prize = prize;
	    window.personData[playerId].rank = index + 1;
	    $('li[data-playerid] .prize:eq(' + index + ')').val(String(prize));
	    const paypal = window.paypal[playerIds[index]];
	    if (paypal) {
		if (paypal.indexOf('@') !== -1) {
		    $('li[data-playerid] .pay:eq(' + index + ')').text(paypal);
		} else {
		    const paymentLink = '<a target="_blank" onclick="handlePaymentClick(' + playerId + ')" href="' + 'https://www.paypal.me/' + paypal + '/' + prize + '">pay</a>';
		    $('li[data-playerid] .pay:eq(' + index + ')').html(paymentLink);
		}
	    }
	});
}

// Handle bulk entry. Just take each line, find player and score, and handle as if entered the usual way.
function processBulkEntry() {

    const content = $('#bulkEntry').val();
    const lines = content.split('\n') || [];
    lines.forEach(line => {
	    let [ player, score ] = line.split(/\t|\s*,\s*/);
	    score = !(score > 0) ? -1 : score;
	    if (player && score) {
		addScore(player, score);
	    }
	});
}

// Copies summary text in the format below to the clipboard
//     Eugene Gershtein - Elks Club weekly on Jan 2, 2020: #1
function handlePaymentClick(playerId) {
    const player = window.personData[playerId];
    const courseName = window.courseData[window.currentCourse].name;
    const date = $('#date').val();
    const note = player.name + ' - ' + courseName + ' weekly on ' + date + ': #' + player.rank;
    navigator.clipboard.writeText(note); // note: requires use of https
}

async function submitResults(e) {

    e.preventDefault();

    // Error checking
    var error = '';
    if (!$('#date').val()) {
	alert("Error: Date missing for weekly.");
	return;
    }

    const results = [];
    const scores = [];
    let result;
    $('#playerData li').each(function(idx, el) {
	    const name = $(el).find('div.playerName').text();
	    const playerId = window.personId[name];
	    const p = window.personData[playerId];
	    const paidCheckbox = $(el).find('input.paid');
	    result = {
		player_id: playerId,
		score: p.score,
		player_handicap: isNaN(p.handicap) ? 'NULL' : p.handicap,
		manual_handicap: p.manualHandicap ? '1' : '0',
		adjusted_score: p.adjScore,
		winnings: $(el).find('input.prize').val(),
		paid: $(paidCheckbox).is(":checked") ? '1' : '0',
		ace: $(el).find('input.ace').val(),
		eagle: $(el).find('input.eagle').val(),
	    };
	    results.push(result);
	    if (result.score !== -1) {
		scores.push(result.score);
	    }
	});;

    const par = (scores.reduce((acc, score) => acc + score, 0) / scores.length).toFixed(2);
    const coursePwd = window.courseData[window.currentCourse].password;
    const weeklyData = {
	courseId: $('#course').val(),
	layout: $('#layout').val(),
	date: toMysqlDate(new Date($('#date').val())),
	notes: $('#notes').val(),
	par,
	coursePwd,
	pwd: $('#password').val(),
	customLayout: $('#customLayout').val(),
	customPar: $('#customPar').val(),
    };

    const weekly_id = window.editMode ? handleEdit(weeklyData, results) : sendResults(weeklyData, results);
}

async function sendResults(weeklyData, results) {

    const weekly_id = await sendRequestAsync('add-weekly', weeklyData);
    if (weekly_id == -1) {
	alert("Error: Incorrect password");
	return;
    }

    results.forEach(result => {
	    sendRequestAsync('add-round', { ...result, weekly_id });
	});

    $('#message').html('<span>Weekly ' + weekly_id + ' added, going to results page ...');
    const test = window.qs.test ? '&test' : '';
    setTimeout(() => window.location.href = 'http://conraddamon.com/dgw/weekly.html?id=' + weekly_id + test, 3000);

    return weekly_id;
};

async function handleEdit(weeklyData, results) {

    const weekly_id = window.weeklyData.id;
    const weeklyUpdate = [];
    const curWeeklyData = window.weeklyData;
    [ 'layout', 'date', 'notes' ].forEach(field => {
	    if ((weeklyData[field] || curWeeklyData[field]) && weeklyData[field] !== curWeeklyData[field]) {
		weeklyUpdate.push(`${field}='${weeklyData[field]}'`);
	    }
	});
    if (weeklyData.par !== curWeeklyData.par) {
	weeklyUpdate.push(`par=${weeklyData.par}`);
    }

    if (weeklyUpdate.length > 0) {
	const update = weeklyUpdate.join(',');
	const dbResult = await sendRequestAsync('update-weekly', { update, weeklyId: weekly_id, coursePwd: weeklyData.coursePwd, pwd: weeklyData.pwd });
	if (dbResult == -1) {
	    alert("Error: Incorrect password");
	    return;
	}
    }

    results.forEach(async (result) => {
	    const curResult = window.weeklyResults.find(weeklyResult => weeklyResult.player_id === result.player_id);
	    if (curResult) {
		const resultUpdate = [];
		[ 'ace', 'eagle' ].forEach(field => {
			if ((result[field] || curResult[field]) && (result[field] !== curResult[field])) {
			    resultUpdate.push(`${field}='${result[field]}'`);
			}
		    });
		[ 'adjusted_score', 'manual_handicap', 'paid', 'player_handicap', 'score', 'winnings' ].forEach(field => {
			const curValue = Number(curResult[field] || 0);
			const newValue = Number(result[field] || 0);
			if (curValue !== newValue) {
			    resultUpdate.push(`${field}=${newValue}`);
			}
		    });

		if (resultUpdate.length > 0) {
		    // console.log('Update for ' + window.personData[result.player_id].name + ': ' + JSON.stringify(resultUpdate));
		    const update = resultUpdate.join(',');
		    await sendRequestAsync('update-round', { update, roundId: curResult.id });
		}
	    } else {
		await sendRequestAsync('add-round', { ...result, weekly_id: weekly_id });
	    }
	});

    window.weeklyResults.forEach(async (weeklyResult) => {
	    const newResult = results.find(result => result.player_id === weeklyResult.player_id);
	    if (!newResult) {
		// console.log('Delete round ' + weeklyResult.id + ' for ' + window.personData[weeklyResult.player_id].name);
		await sendRequestAsync('delete-round', { roundId: weeklyResult.id });
	    }
	});

    $('#message').html('<span>Weekly ' + weekly_id + ' edited, going to results page ...');
    const test = window.qs.test ? '&test' : '';
    setTimeout(() => window.location.href = 'http://conraddamon.com/dgw/weekly.html?id=' + weekly_id + test, 3000);

    return weekly_id;
};

function gotWeekly(data) {

    window.weeklyData = data;

    $('#course option[value="' + data.course_id + '"]').prop('selected', true);
    $('#layout option[value="' + data.layout + '"]').prop('selected', true);

    var d = data.date.split('-');
    $('#date').datepicker('setDate', new Date(d[0], Number(d[1]) - 1, d[2]));

    $('#notes').val(data.notes || '');
}

function gotResults(data) {

    window.weeklyResults = data;

    data = data || [];
    data.forEach(function(round) {
	    var id = round.player_id,
		person = window.personData[id],
		player = person.name || 'Unknown';

	    showScore(player, round.score, round.player_handicap);

	    if (Number(round.winnings) > 0) {
		$('#playerData li[data-playerid="' + id + '"] input.prize').val(round.winnings);
	    }
	    if (round.paid == '1') {
		$('#playerData li[data-playerid="' + id + '"] input.paid').prop('checked', true);
	    }
	    if (round.ace) {
		$('#playerData li[data-playerid="' + id + '"] input.ace').val(round.ace);
	    }
	    if (round.eagle) {
		$('#playerData li[data-playerid="' + id + '"] input.eagle').val(round.eagle);
	    }
	});
}
