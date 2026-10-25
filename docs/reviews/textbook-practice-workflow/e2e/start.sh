# usage: start.sh <dir> <port>
S=${QA_DIR:-$(cd "$(dirname "$0")" && pwd)}
. $S/env.sh
pkill -f "next start -p $2" ; sleep 1
cd $1 && nohup pnpm exec next start -p $2 > $S/server-$2.log 2>&1 &
