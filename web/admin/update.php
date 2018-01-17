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
$sql = "INSERT into weekly (course_id,layout,date,notes) VALUES($courseId,'$layout','$date',$notes)";
$weeklyId = db_query($sql);

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

  $sql = "INSERT into round (weekly_id,player_id,score,player_handicap,adjusted_score,winnings,paid,ace,eagle,manual_handicap) VALUES($weeklyId,$playerId,$score,$handicap,$adjScore,$prize,$paid,$ace,$eagle,$manualHandicap)";
  db_query($sql);
  $scores[$playerId] = $score;
}

# calculate par for the weekly
$par = round($totalScore / $numRounds);
$sql = "UPDATE weekly SET par=$par WHERE id=$weeklyId";
db_query($sql);

# get settings
$sql = "SELECT COUNT(*) FROM weekly WHERE course_id=$courseId";
$numWeeklies = db_query($sql, 'count');
$hcapStartWeek = $courseResult['handicap_start'];
$handicapping = $numWeeklies >= $hcapStartWeek - 1;
$hcapMinRounds = $courseResult['handicap_rounds'];
$hcapRate = $courseResult['handicap_rate'] / 100;

$players = array_keys($scores);
elog(LOG_INFO, "num weeklies: $numWeeklies / start: $hcapStartWeek / rounds: $hcapMinRounds");

# if we're about to start handicapping, handle players who have played enough rounds but
# did not play this week
if ($numWeeklies == $hcapStartWeek - 1) {
#  elog(LOG_INFO, "handicap start");
  $sql = "SELECT player_id FROM handicap WHERE course_id=$courseId AND rounds>=$hcapMinRounds AND handicap IS NULL";
  $result = db_query($sql);
#  elog(LOG_INFO, var_export($result, true));
  if ($result) {
    foreach($result as $r) {
      $pid = $r['player_id'];
#      elog(LOG_INFO, "checking player $pid");
      if (!in_array($pid, $players)) {
#	elog(LOG_INFO, "*** adding $pid to handicap updates");
	array_push($players, $pid);
      }
    }
  }
}
#elog(LOG_INFO, var_export($players, true));

# update handicaps as appropriate
foreach ($players as $playerId) {
  $score = $scores[$playerId];
  if ($score == -1) { // DNF
    continue;
  }
  $sql = "SELECT rounds,delta FROM handicap WHERE player_id=$playerId AND course_id=$courseId";
  $result = db_query($sql, 'one');
  $rounds = $result ? $result['rounds'] : 0;
  $delta = $result ? $result['delta'] : 0;
#   elog(LOG_INFO, "hcap info for player $playerId: $rounds / $delta");
  if ($score) {
    $rounds = $rounds + 1;
    $delta = $delta + ($score - $par);
  }
#   elog(LOG_INFO, "rounds: $rounds, delta: $delta");
  $handicap = 'NULL';
  if ($handicapping && $rounds >= $hcapMinRounds) {
    $handicap = round($hcapRate * ($delta / $rounds));
    if ($handicap === -0) {
      $handicap = 0;
    }
#    elog(LOG_INFO, "new handicap is: $handicap");
  }
  if ($result) {
    $update = "rounds=$rounds,delta=$delta";
    if ($handicap !== 'NULL') {
      $update = $update . ",handicap=$handicap";
    }
#    elog(LOG_INFO, "updating handicap: $update");
    $sql = "UPDATE handicap SET $update WHERE player_id=$playerId AND course_id=$courseId";
  }
  else {
    $sql = "INSERT INTO handicap (player_id,course_id,rounds,delta,handicap) VALUES($playerId,$courseId,$rounds,$delta,$handicap)";
#    elog(LOG_INFO, "inserting handicap: $handicap");
  }
  db_query($sql);
}

header("Location: /dgw/weekly.html?id=$weeklyId");
die();
?>
