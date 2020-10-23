<?php
#-----------------------------------------------------------------------------#
# File: update.php
# Author: Conrad Damon
# Date: 01/02/2017
#
# This file uses PHP to take a form post of disc golf tourney results and massages
# it for entry into a MySQL database.
#-----------------------------------------------------------------------------#

require_once('db.php');
require_once('log.php');

#var_dump($_POST);

$courseId = get_input('course', 'post');
$layout = get_input('layout', 'post');
$date = get_input('date', 'post');
$pw = get_input('password', 'post');
$notes = get_input('notes', 'post');
$results = get_input('results', 'post');

$weeklyId = get_input('weeklyId', 'post');
$editMode = ($weeklyId > 0);
elog(LOG_INFO, "post to update.php, edit mode: " . $editMode);

# reformat the date for mysql
$date = date("Y-m-d", strtotime($date));

$notes = $notes ? "'$notes'" : 'NULL';

# get course info
$sql = "SELECT * FROM course WHERE id=$courseId";
$courseResult = db_query($sql, 'one');
if (crypt($pw, $pw) != $courseResult['password']) {
  echo "Invalid password.";
  echo crypt($pw, $pw) . " does not match " . $courseResult['password'];
  die();
}

# add a row for the weekly
if (!$editMode) {
  $sql = "INSERT into weekly (course_id,layout,date,notes) VALUES($courseId,'$layout','$date',$notes)";
  $weeklyId = db_query($sql);
}

# add the players' rounds
$players = explode('|', $results);
$totalScore = $num_rounds = 0;
foreach ($players as $player) {
  list($playerId, $score, $handicap, $adjScore, $prize, $paid, $ace, $eagle, $manualHandicap) = explode(':', $player);
  if ($score > 0) {
    $totalScore = $totalScore + $score;
    $numRounds++;
  }
  $handicap = $handicap !== '' ? $handicap : 'NULL';
  $prize = $prize !== '' ? $prize : 0;
  $paid = $paid == 'y' ? 'TRUE' : 'FALSE';
  $ace = $ace !== '' ? "'$ace'" : 'NULL';
  $eagle = $eagle !== '' ? "'$eagle'" : 'NULL';
  $manualHandicap = $manualHandicap == 'y' ? 'TRUE' : 'FALSE';

  if ($editMode) {
    $update = array();
    array_push($update, 'score=' . $score);
    array_push($update, 'player_handicap=' . $handicap);
    array_push($update, 'adjusted_score=' . $adjScore);
    array_push($update, 'winnings=' . $prize);
    array_push($update, 'paid=' . $paid);
    array_push($update, 'ace=' . $ace);
    array_push($update, 'eagle=' . $eagle);
    array_push($update, 'manual_handicap=' . $manualHandicap);
    $sql = "UPDATE round SET " . implode(',', $update) . " WHERE weekly_id=$weeklyId AND player_id=$playerId";
  } else {
    $sql = "INSERT into round (weekly_id,player_id,score,player_handicap,adjusted_score,winnings,paid,ace,eagle,manual_handicap) VALUES($weeklyId,$playerId,$score,$handicap,$adjScore,$prize,$paid,$ace,$eagle,$manualHandicap)";
  }
  db_query($sql);

  $scores[$playerId] = $score;
}

# calculate par for the weekly
$par = round($totalScore / $numRounds, 2);
$sql = "UPDATE weekly SET par=$par WHERE id=$weeklyId";
db_query($sql);

header("Location: /dgw/weekly.html?id=$weeklyId");
die();
?>
