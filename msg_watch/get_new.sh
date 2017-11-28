#/bin/sh
NEW=`curl http://adbg.herokuapp.com/messages 2>/dev/null`
if (( $? != 0)); then
  exit $?
fi
touch new.json
mv new.json last.json
echo $NEW | jq . > new.json
diff -q last.json new.json
if (( $? != 0 )) ; then
  echo "New Message"
  # say "New Message"
  RAW_DIFF=`git --no-pager diff --no-index --no-color -- new.json last.json`
  PART=`echo $RAW_DIFF | egrep "^- " | cut -c 2- `
  if ( echo $RAW_DIFF | grep replies ) ; then
    echo {$PART} | jq .replies
  else
    echo $PART | sed '$ s/,$//' | jq .body
  fi
  TIME=`date +%s`
  mkdir log/$TIME
  cp *.json log/$TIME/
else
  echo "No news"
fi
