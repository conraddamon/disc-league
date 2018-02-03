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

elseif ($op == 'get-handicap') {
  $pid = get_input('playerId', 'get');
  $cid = get_input('courseId', 'get');
  $sql = "SELECT handicap FROM handicap WHERE player_id=$pid AND course_id=$cid";
  $result = db_query($sql, 'one');
}

elseif ($op == 'add-player') {
  $player = get_input('player', 'get');
  $sql = "INSERT INTO player (name) VALUES('$player')";
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

echo json_encode($result);
?>
