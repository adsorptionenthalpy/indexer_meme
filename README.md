# four.meme-indexer

## Instructions:

Use node 16\
\
Install packages:\
npm install

Ensure postgresql in installed\
**Start postgresql service:** sudo systemctl start postgresql (or  sudo service postgresql start)\
**Enable postgresql on boot:** sudo systemctl enable postgresql\
\
**set RPC_URL in .env** (use web socket to a BNBChain api) (RPC_URL=wss://...)\
**set DATABASE_URL in .env**  (DATABASE_URL="postgresql://prisma:prisma@localhost:5432/fourmeme?schema=public")\
\
**Create the database:** \
\
sudo -u postgres createdb fourmeme\
sudo -u postgres psql -c "CREATE USER prisma WITH ENCRYPTED PASSWORD 'prisma';"\
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fourmeme TO prisma;"\
sudo -u postgres psql -d fourmeme -c "GRANT ALL ON SCHEMA public TO prisma;"\
\
You may have to be use the postgres account: sudo su - postgres\
\
Alernatively, use the dockerfile: \
\
docker run --name pg-fourmeme -e POSTGRES_PASSWORD=prisma -e POSTGRES_USER=prisma -e POSTGRES_DB=fourmeme -p 5432:5432 -d postgres:16\
*If this does not exist it will be downloaded.*\
\
\
npx prisma generate\
npx prisma migrate dev --name init (*or npx prisma db push if there are problems*)\
\
npm run build\
\
npm run start\
\
curl http://localhost:3001/latest 

