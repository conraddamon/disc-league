/*
 * Functions for the results form (results.html).
 */

/**
 * Sets up key handlers, adds a date picker, and sets up form submission.
 */
function initializeResults() {

    // handle Enter key
    $(':text').on('keypress keydown keyup', keyHandler);
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

    // we handle form submit
    $('#submitButton').click(submitResults);

    // assume we've started handicaps
    window.handicapping = true;

    // remember query string args
    window.qs = parseQueryString();

    // fetch data
    getCourse(handleCourseInfo);
    getPlayer(handlePlayerInfo);
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

/**
 * Stores course data in a global window variable.
 *
 * @param {Object} data    Course data from db
 */
function handleCourseInfo(data) {

    // Change current course when user picks a different course
    $('#course').on('change', onCourseSelected);

    var courseToSelect = window.qs.courseId || 1,
	isTest = window.qs.test,
	cd = window.courseData = {}; // global storage for course data

    for (var i = 0; i < data.length; i++) {
	var course = data[i];
	if (isTest && course.name !== 'Test') {
	    continue;
	}
	
	var option = new Option(course.name, course.id);
	cd[course.id] = course;
	$('#course').append($(option));
	if (isTest) {
	    courseToSelect = course.id;
	}
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
function handlePlayerInfo(data) {

    saveNames(data);
    addNameAutocomplete(getNameList(data));

    if (window.qs.weeklyId) {
	window.editMode = true;
	sendRequest('get-weekly',  { weeklyId: window.qs.weeklyId }, gotWeekly).then(function() {
		sendRequest('get-results', { weeklyId: window.qs.weeklyId }, gotResults);
	    });
    }
}

/**
 * Updates the displayed course information, including available layouts (if more than one), entry, and
 * prize information.
 *
 * @param {Event} e    Browser event
 * @param {int} value  [optional] course ID to force selection
 */
function onCourseSelected(e, value) {

    value = value || this.value;

    var showLayouts = false,
	course = window.courseData[value];

    window.currentCourse = course.id;

    updateTitle();

    // re-create the layouts select dropdown
    $('#layout option').remove();
    var layoutStr = course.layouts || '',
	layouts = layoutStr.split(/[\s,]+/);
    // create a select if there are multiple layouts
    if (layouts && layouts.length > 1) {
	for (var j = 0; j < layouts.length; j++) {
	    var layout = layouts[j],
		option = new Option(layout, layout);
	    $('#layout').append($(option));
	}
	showLayouts = true;
    }
    $('#layoutContainer').css('display', showLayouts ? 'inline-block' : 'none');

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

    // find out how many weeklies this course has had (to know whether handicapping is in effect)
    if (course.numWeeklies == null) {
	getNumWeeklies(course.id, handleNumWeeklies);
    }
}

/**
 * Fetches the number of weeklies held at the given course
 *
 * @param {int}      courseId    Course ID
 * @param {Function} callback    Function to call with results
 */
function getNumWeeklies(courseId, callback) {

    callback = callback.bind(null, courseId);
    sendMessage('get-num-weeklies', callback, { courseId: courseId });
}

/**
 * Stores the number of weeklies for the given course. There is a small chance of a race condition,
 * where the user could start entering player scores before this is called, so that we don't know
 * if handicapping is in effect. For that reason, we default handicapping to true during initialization.

 * @param {Function} callback    Function to call with results
 */
function handleNumWeeklies(courseId, numWeeklies) {

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
 * Starts the process of adding a player data row to the table. If the player is new, add them. If the
 * player is known, fetch their handicap (if handicapping is in effect).
 */
function addScore() {

    var player = $('#player').val(),
	score = $('#score').val();

    if (!$.isNumeric(score)) {
	return;
    }

    if (!window.personId[player]) {
	addPlayer(player, score, handlePlayerAdd);
    }
    else if (window.handicapping && !$('#handicap').val()) {
	getHandicap(player, score, handleHandicap);
    }
    else {
	showScore(player, score);
    }
}

/**
 * Fetches the given player's handicap.
 *
 * @param {String}   player      Player name
 * @param {int}      score       Player score
 * @param {Function} callback    Function to call with results
 */
function getHandicap(player, score, callback) {

    callback = callback.bind(null, player, score);
    sendMessage('get-handicap', callback, { courseId: $('#course').val(), playerId: window.personId[player] });
}

/**
 * Adds a player to the database.
 *
 * @param {String}   player      Player name
 * @param {int}      score       Player score
 * @param {Function} callback    Function to call with results
 */
function addPlayer(player, score, callback) {

    callback = callback.bind(null, player, score);
    sendMessage('add-player', callback, { player: player });
}

/**
 * Adds a player row now that we have their handicap.
 *
 * @param {String}   player      Player name
 * @param {int}      score       Player score
 * @param {Object}   data        Result from db query
 */
function handleHandicap(player, score, data) {

    showScore(player, score, data && data.handicap);
}

/**
 * Adds a player row with just their score.

 * @param {String}   player      Player name
 * @param {int}      score       Player score
 * @param {int}      playerId    Player ID for newly added player
 */
function handlePlayerAdd(player, score, playerId) {

    window.personData[playerId] = { name: player };
    window.personId[player] = playerId;
    showScore(player, score);
}

/**
 * Adds a row to the table of player scores. If a handicap is provided, calculates and shows the
 * adjusted score.
 *
 * @param {String}   player      Player name
 * @param {int}      score       Player score
 * @param {int}      handicap    Player handicap (can be null if player lacks one)
 */
function showScore(player, score, handicap) {

    var manualHandicap = $('#handicap').val();
    if (manualHandicap) {
	handicap = Number(manualHandicap);
    }

    var id = window.personId[player],
	p = window.personData[id],
	adjScore = handicap != null ? score - handicap : score;

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
        index = getPlayerSortIndex(id),
	score1 = (score == -1) ? 'DNF' : score,
	adjScore1 = (score == -1) ? 'DNF' : adjScore,
	handicap1 = (score != -1 && handicap != null) ? handicap : ' ';

    var ace = (course.ace > 0) ? "<div class='dataCell'><input type='text' class='ace' /></div>" : '',
        eagle = (course.eagle > 0) ? "<div class='dataCell'><input type='text' class='eagle' /></div>" : '';

    var handicapHtml = window.handicapping ? "<div class='dataCell playerHandicap'>" + handicap1 + "</div>" : '',
	adjScoreHtml = window.handicapping ? "<div class='dataCell playerAdjScore'>" + adjScore1 + "</div>" : '';
    
    var html = "<li data-playerid='" + id + "'><div class='playerName'>" + player + "</div><div class='dataCell playerScore'>" + score1 + "</div>" + handicapHtml + adjScoreHtml + "<div class='dataCell'><input type='text' class='prize' /></div><div class='dataCell'><input type='checkbox' class='paid' value='y' /></div>" + ace + eagle + "<div class='dataCell imgTrash' onclick='removeRow(event);'></div></li>";

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
}

/**
 * Removes the row containing the clicked trash icon.
 *
 * @param {Event} e    Browser event
 */
function removeRow(e) {

    $(e.target).parent().remove();
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
    $('li[data-playerid]').each(function(idx, el) {
	    var playerId = el.dataset.playerid,
		p1 = window.personData[id],
		p1a = p1.score == -1 ? 5000 : parseInt(p1.adjScore),
		p1test = p1.handicap != null ? p1a : p1a + 1000,
		p2 = window.personData[playerId],
		p2a = p2.score == -1 ? 5000 : parseInt(p2.adjScore),
		p2test = p2.handicap != null ? p2a : p2a + 1000;
	    
	    if (p1test < p2test) {
		index = idx;
		return false;
	    }
	});

    return index;
}

/**
 * Sends the form with all the weekly info and round results to the server.
 *
 * @param {Event} e    Browser event
 */
function submitResults(e) {

    e.preventDefault(); // we'll submit the form when we're ready

    // Error checking
    var error = '';
    if (!$('#date').val()) {
	error = "Date missing for weekly.";
    }
    if (error) {
	alert("Error: " + error);
	return;
    }

    // Encode the round results for the server to handle, and put the result in a hidden form field.
    // Fields for a single round are separated by ":", and rounds are separated by "|".
    var results = [];
    $('#playerData li').each(function(idx, el) {
	    var name = $(el).find('div.playerName').text(),
		playerId = window.personId[name],
		p = window.personData[playerId],
		score = p.score,
		handicap = p.handicap,
		manualHandicap = p.manualHandicap ? 'y' : '',
		adjScore = p.adjScore,
		prize = $(el).find('input.prize').val(),
		paidCheckbox = $(el).find('input.paid'),
		paid = $(paidCheckbox).is(":checked") ? 'y' : '',
		ace = $(el).find('input.ace').val(),
		eagle = $(el).find('input.eagle').val();

	    results.push([playerId,score,handicap,adjScore,prize,paid,ace,eagle,manualHandicap].join(':'));
	});
    $('#playerResults').val(results.join('|'));
    if (window.editMode) {
	$('#weeklyId').val(window.qs.weeklyId);
    }

    // Go!
    $('#form1').submit();
}

function gotWeekly(data) {

    $('#course option[value="' + data.course_id + '"]').prop('selected', true);
    $('#layout option[value="' + data.layout + '"]').prop('selected', true);

    var d = data.date.split('-');
    $('#date').datepicker('setDate', new Date(d[0], Number(d[1]) - 1, d[2]));

    $('#notes').val(data.notes || '');
}

function gotResults(data) {

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
