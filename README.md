# Articles API

### The design and fundamentals

Since I've done lots of these APIs with Node/Express, I decided to use them here also since it's fast enough for me. I think this could be quite production ready with user identification (JWT Tokens, OAuth, AWS Cognito, etc.) and few security/fallback rules, but I kept it very simplistic and barebones type. To get only the wanted content from an article, I decided to read it in as DOM and meddle with it.

### Considerations

I was also thinking of making this a serverless service as a AWS Lambda function with DynamoDB database, which still could be done with small modifications. 

### Requirements
* NodeJS v21
* NPM
* Nodemon (by `npm i nodemon -g`)

### Optional reuirements
* ESBuild (by `npm i esbuild -g`) for bundling
* Docker for containerization
* AWS account for the image deployment

### Run (development) from a container

`docker compose up`

Will be running on http://localhost:3000/

OpenAPI documentation will be at: http://localhost:3000/api-docs/

### Build docker image

`docker build -t articles-api:latest .`


### App scripts

**Install packages**

`npm install`

**Run**

`npm run start`

**Run'n'develop**

`npm run dev`

**Build**

`npm run build`

**Deploy**

`docker push [your-aws-ecs-uri]:latest`

Launch an EC2 instance from the image

### Directory structure

|Name|Description|
|-|-|
|`/build`|Built output|
|`/src`|Main source directory|
|`/node_modules`|The half of the internet|
|`.env`|Environmental parameters to use locally|
|`api.yaml`|OpenAPI Swagger definitions|
|`prettier.js`|Makes code less chaotic|