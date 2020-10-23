<?php
#-----------------------------------------------------------------------------#
# File: course.php
# Author: Conrad Damon
# Date: 01/22/2017
#
# Allows an admin to add or edit a course.
#-----------------------------------------------------------------------------#

require_once('db.php');
require_once('log.php');
require_once('util.php');

#var_dump($_POST);

$courseId = get_input('courseId', 'post');
$editMode = ($courseId > 0);
elog(LOG_INFO, "post to course.php, edit mode: " . $editMode);

$textFields = array('name', 'contact_name', 'contact_email', 'password', 'layouts', 'location', 'note');
$numericFields = array('entry', 'prize', 'ace', 'eagle', 'handicap_min_rounds', 'handicap_start', 'handicap_rate', 'handicap_num_rounds', 'initial_ace', 'initial_eagle');
$moneyFields = array('entry', 'prize', 'ace', 'eagle', 'initial_ace', 'initial_eagle');
$allFields = array_merge($textFields, $numericFields);
elog(LOG_INFO, "count: " . count($allFields));

if ($courseId) {
  $sql = "SELECT * FROM course WHERE id=$courseId";
  $result = db_query($sql, 'one');
  $update = array();
  foreach ($allFields as $f) {
    if ($f == 'password') {
      continue;
    }
    $formVal = getValue($f);
    $curVal = $result[$f];
    elog(LOG_INFO, $f . ": comparing form val [" . $formVal . "] to cur val [" . $curVal . "]");
    if ($formVal != $curVal) {
      if (!$formVal) {
	$formVal = $isText ? '' : '0';
      }
      $val = in_array($f, $textFields) ? quote($formVal) : $formVal;
      array_push($update, $f . '=' . $val);
    }
  }
  if (count($update) > 0) {
    $sql = "UPDATE course SET " . implode(',', $update) . " WHERE id=$courseId";
    elog(LOG_INFO, $sql);
    db_query($sql);
  }
}
else {
  $data = array();
  foreach ($allFields as $f) {
    $data[$f] = getValue($f, true);
  }
  $keys = array();
  $values = array();
  foreach ($data as $key => $value) {
    array_push($keys, $key);
    array_push($values, $value);
  }
  $sql = "INSERT INTO course(" . implode(',', $keys) . ") VALUES (" . implode(',', $values) . ")";
  elog(LOG_INFO, $sql);
  $courseId = db_query($sql);
}

function getValue($f, $quote=false) {

  global $textFields, $numericFields, $moneyFields;

  $val = get_input($f, 'post');

  $isText = !in_array($f, $numericFields);
  if (!$val) {
    $val = $isText ? '' : '0';
  }
  else if (is_array($val)) {
    $val = implode(',', $val);
  }
  else if ($f == 'password') {
    $val = crypt($val, $val);
  }
  else if (in_array($f, $moneyFields)) {
    $val = str_replace('$', '', $val);
  }

  return $quote && $isText ? quote($val) : $val;
}


header("Location: /dgw/course.html?id=$courseId");
die();
?>
