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
