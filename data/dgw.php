<?php
#-----------------------------------------------------------------------------#
# File: dgw.php
# Author: Conrad Damon
# Date: 01/02/2017
#
# This file provides an interface to a database storing data related to 
# managing disc golf weeklies.
#-----------------------------------------------------------------------------#

# Minimal security check to prevent direct access to REST calls
if ($_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
  exit('');
}

require_once('db.php');
require_once('log.php');
require_once('util.php');

$pw_master = 'wfuIyceA0.YCA';

$op = get_input('op', 'get');
elog(LOG_INFO, "dgw.php, op=$op");

$option = null;
if ($op == 'load-course') {
  $cid = get_input('courseId', 'get');
  $sql = "SELECT * FROM course WHERE 1";
  if ($cid) {
    $sql = "SELECT * FROM course WHERE id=$cid";
    $option = 'one';
  }
  $result = db_query($sql, $option);
}

elseif ($op == 'get-num-weeklies') {
  $cid = get_input('courseId', 'get');
  $sql = "SELECT COUNT(*) FROM weekly WHERE course_id=$cid";
  $result = db_query($sql, 'count');
  elog(LOG_INFO, "num weeklies: $result");
}

elseif ($op == 'load-player') {
  $sql = "SELECT * FROM player WHERE 1";
  $result = db_query($sql);
}

elseif ($op == 'add-player') {
  $player = get_input('player', 'get');
  $sql = "INSERT INTO player (name) VALUES('$player')";
  $result = db_query($sql);
}

elseif ($op == 'get-players') {
  $cid = get_input('courseId', 'get');
  $wid = get_input('weeklyId', 'get');
  $sql = "SELECT DISTINCT p.id,p.name FROM player p, round r INNER JOIN weekly w ON r.weekly_id=$wid WHERE r.player_id=p.id AND w.course_id=$cid";
  error_log($sql);
  $result = db_query($sql);
}

elseif ($op == 'check-password') {
  $cid = get_input('courseId', 'get');
  $pw = get_input('pw', 'get');
  $sql = "SELECT password FROM course WHERE id=$cid";
  $res = db_query($sql, 'one');
  $test = crypt($pw, $pw);
  $result = ($test == $res['password'] || $test == $pw_master) ? true : false;
  elog(LOG_INFO, $pw . " / " . $test . " / " . $res['password']);
}

elseif ($op == 'get-weekly') {
  $wid = get_input('weeklyId', 'get');
  $sql = "SELECT * FROM weekly WHERE id=$wid";
  $result = db_query($sql, 'one');
}

elseif ($op == 'get-results') {
  $wid = get_input('weeklyId', 'get');
  $sql = "SELECT * FROM round WHERE weekly_id=$wid";
  $result = db_query($sql);
}

elseif ($op == 'get-pars') {
  $cid = get_input('courseId', 'get');
  $sql = "SELECT id,par FROM weekly WHERE course_id=$cid";
  $result = db_query($sql);
}

# TODO: limit to course (requires a join)
elseif ($op == 'get-scores') {
  $where = "score > 0";
  $wid = get_input('weeklyId', 'get');
  if ($wid) {
    $where = $where . " AND weekly_id < $wid";
  }
  $sql = "SELECT weekly_id,player_id,score FROM `round` WHERE $where ORDER BY player_id,weekly_id DESC";
  $result = db_query($sql);
}

elseif ($op == 'add-weekly') {
  $pwd = get_input('pwd', 'get');
  $coursePwd = get_input('coursePwd', 'get');
  if (crypt($pwd, $pwd) != $coursePwd) {
    $result = -1;
  }
  else {
    $cid = get_input('courseId', 'get');
    $layout = get_input('layout', 'get');
    $date = get_input('date', 'get');
    $par = get_input('par', 'get');
    $notes = get_input('notes', 'get');
    $notes = $notes ? "'$notes'" : 'NULL';
    $sql = "INSERT into weekly (course_id,layout,date,par,notes) VALUES($cid,'$layout','$date',$par,$notes)";
    error_log($sql);
    $result = db_query($sql);
  }
}

elseif ($op == 'add-round') {
  $wid = get_input('weekly_id', 'get');
  $pid = get_input('player_id', 'get');
  $score = get_input('score', 'get');
  $hcap = get_input('player_handicap', 'get');
  $adjScore = get_input('adjusted_score', 'get');
  $prize = get_input('winnings', 'get');
  $paid = get_input('paid', 'get');
  $ace = get_input('ace', 'get');
  $eagle = get_input('eagle', 'get');
  $manualHcap = get_input('manual_handicap', 'get');

  $hcap = $hcap ? $hcap : 'NULL';
  $prize = $prize !== '' ? $prize : 0;
  $paid = $paid == '1' ? 'TRUE' : 'FALSE';
  $ace = $ace !== '' ? "'$ace'" : 'NULL';
  $eagle = $eagle !== '' ? "'$eagle'" : 'NULL';
  $manualHcap = $manualHcap == '1' ? 'TRUE' : 'FALSE';

  $sql = "INSERT into round (weekly_id,player_id,score,player_handicap,adjusted_score,winnings,paid,ace,eagle,manual_handicap) VALUES($wid,$pid,$score,$hcap,$adjScore,$prize,$paid,$ace,$eagle,$manualHcap)";
  error_log($sql);
  $result = db_query($sql);
}

elseif ($op == 'update-weekly') {
  $pwd = get_input('pwd', 'get');
  $coursePwd = get_input('coursePwd', 'get');
  if (crypt($pwd, $pwd) != $coursePwd) {
    $result = -1;
  }
  else {
    $wid = get_input('weeklyId', 'get');
    $update = get_input('update', 'get');
    $sql = "UPDATE weekly SET $update WHERE id=$wid";
    error_log($sql);
    $result = db_query($sql);
  }
}

elseif ($op == 'update-round') {
  $rid = get_input('roundId', 'get');
  $update = get_input('update', 'get');
  $sql = "UPDATE round SET $update WHERE id=$rid";
  error_log($sql);
  $result = db_query($sql);
}

echo json_encode($result);
?>
