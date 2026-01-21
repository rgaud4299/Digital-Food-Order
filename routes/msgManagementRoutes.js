const express = require('express');
const router = express.Router();
const createSecuredRoutes = require('../utils/createSecuredRoutes');

const controller = require('../controllers/Admin/Msg Management/msgApiController');
const signatureController = require('../controllers/Admin/Msg Management/msgSignatureController');
const msgContentsController = require('../controllers/Admin/Msg Management/msgContentsController');
const {authMiddleware} = require('../middleware/auth');

const { 
  addApiValidation, updateApiValidation,   
} = require('../validators/msgApiValidation');

const { addOrUpdateSignatureValidator } = require('../validators/msgSignatureValidator');
const { 
  addMsgContentValidation, updateMsgContentValidation,changeMsgContentStatusValidation
} = require('../validators/msgContentsValidator');
const { idParamValid, ListValidation } = require('../validators/commonValidators');



const securedRoutes = createSecuredRoutes(authMiddleware, (router) => {
 
  // Msg APIsl 
  router.post('/msg-apis/add', addApiValidation, controller.addMsgApi);
  router.post('/msg-apis/get-list', ListValidation,controller.getMsgApiList);
  router.get('/msg-apis/byid/:id', idParamValid, controller.getMsgApiById);
  router.put('/msg-apis/update/:id',idParamValid,updateApiValidation, controller.updateMsgApi);
  router.delete('/msg-apis/delete/:id',idParamValid , controller.deleteMsgApi);
  router.patch('/msg-apis/change-status/:id',idParamValid, controller.changeMsgApiStatus);

  // Signatures
  router.post('/signature', addOrUpdateSignatureValidator, signatureController.addOrUpdateSignature);
  router.post('/signature/get-list',  ListValidation, signatureController.getSignatureList);

  // Msg Contents
  router.post('/msg-contents/add', addMsgContentValidation, msgContentsController.addMsgContent);
  router.post('/msg-contents/get-list', msgContentsController.getMsgContentList);
  router.get('/msg-contents/byid/:id',idParamValid, msgContentsController.getMsgContentById);
  router.put('/msg-contents/updated/:id',idParamValid, updateMsgContentValidation, msgContentsController.updateMsgContent);
  router.delete('/msg-contents/delete/:id',idParamValid, msgContentsController.deleteMsgContent);
  router.patch('/msg-contents/change-status/:id', changeMsgContentStatusValidation, msgContentsController.ChangeMsgContentStatus );

});
router.use('/', securedRoutes); 

module.exports = router;
