#/bin/sh
touch new.json
mv new.json last.json
curl http://adbg.herokuapp.com/messages 2>/dev/null | jq . > new.json
diff -q last.json new.json
if (( $? != 0 )) ; then
  echo "New Message"
  # say "New Message"
  git --no-pager diff --no-index --no-color -- new.json last.json | egrep "^- " | cut -c 2- | sed '$ s/,$//' | jq .body
else
  echo "No news"
fi
