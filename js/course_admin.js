/*
 * Functions for adding or editing course info (course.html)
 */

const REQUIRED = [ 'name', 'contact_name', 'contact_email', 'password' ];

function initializeCourse() {

    window.qs = parseQueryString();
    var courseId = window.currentCourse = window.qs.id;
    window.editMode = !!window.currentCourse;

    if (courseId) {
	getCourse(handleCourse, courseId);
	$('#courseId').val(courseId);
    }

    // intercept form post so we can do validation
    $('#submitButton').click(submitForm);
}

function handleCourse(course) {

    $('.title').text('Edit Course: ' + course.name);
    $('#passwordDesc').text("Enter the password for " + course.name);
    $('#submitButton').text('Edit Course');
    $('#newPasswordContainer').show();

    // check password on blur
    $('#password').blur(passwordBlurHandler);

    // populate form
    var ignore = { 'password':1, 'id':1 };
    for (var field in course) {
	if (ignore[field]) {
	    continue;
	}
	$('#' + field).val(course[field]);
    }
}

function submitForm(e) {

    e.preventDefault(); // don't let browser post the form

    // check for required fields
    for (var i = 0; i < REQUIRED.length; i++) {
	var field = REQUIRED[i],
	    value = $('#' + field).val();

	if (value == null) {
	    var label = $('#' + field + '_label').text().replace('*', '').replace(':', '');
	    alert("Missing required field: " + label);
	    return;
	}
    }

    // Go!
    $('#form1').submit();
}
