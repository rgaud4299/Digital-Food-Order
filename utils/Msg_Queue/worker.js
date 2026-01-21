
const { sendDynamicMessage } = require("../Helper/sendDynamicMessage");
const { makeAxiosRequest } = require("../httpHelper");
const { Worker, connection } = require("./messageQueue");

const worker = new Worker(
  "messageQueue",
  async (job) => {
 
    await sendDynamicMessage(job.data);
    return "msg send successfully by msg Queue";
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ msg ${job.id} completed:`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});



























// const { Worker, connection } = require("./messageQueue");
// const { makeAxiosRequest } = require("../httpHelper");


// function runWorker(queueName = "messageQueue", jobType = "sendMessage") {
//   const worker = new Worker(
//     queueName,
//     async (job) => {
//       const { completeUrl, method } = job.data;

//       const response = await makeAxiosRequest(completeUrl, {}, method);

//       return { response };
//     },
//     { connection }
//   );

//   worker.on("completed", (job) => {
//     console.log(`✅ Job ${job.id} completed:`, job.returnvalue);
//     worker.close(); // close after processing
//   });

//   worker.on("failed", (job, err) => {
//     console.error(`❌ Job ${job?.id} failed:`, err.message);
//     worker.close();
//   });

//   return worker;
// }

// module.exports = { runWorker };
