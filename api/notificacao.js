const axios = require('axios');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const meuEmail = process.env.MEU_EMAIL_CONTATO;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).send('Método não permitido');
    return;
  }

  const { id } = request.body.data || request.query;

  if (!id) {
    response.status(400).send('Dados de notificação inválidos.');
    return;
  }

  try {
    const url = `https://api.mercadopago.com/v1/payments/${id}`;
    const headers = {
      'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
    };
    
    const mpResponse = await axios.get(url, { headers });
    const pagamento = mpResponse.data;

    if (pagamento.status !== 'approved') {
      response.status(200).send('Pagamento não aprovado. Nenhuma ação será tomada.');
      return;
    }

    const nomeComprador = pagamento.payer.first_name ? `${pagamento.payer.first_name} ${pagamento.payer.last_name}` : 'Comprador não informado';
    const emailComprador = pagamento.payer.email || 'email@nao-informado.com';
    const planoAdquirido = (pagamento.additional_info.items && pagamento.additional_info.items.length > 0) ? pagamento.additional_info.items[0].title : 'Plano não informado';

    // 1. Envia e-mail de notificação para você
    let emailParaVoce = new SibApiV3Sdk.SendSmtpEmail();
    emailParaVoce.sender = { email: meuEmail };
    emailParaVoce.to = [{ email: meuEmail }];
    emailParaVoce.subject = `Nova Venda de Preparatório - ${planoAdquirido}`;
    emailParaVoce.htmlContent = `
      <p>Olá, uma nova venda foi realizada com sucesso!</p>
      <p><b>Nome do Comprador:</b> ${nomeComprador}</p>
      <p><b>E-mail:</b> ${emailComprador}</p>
      <p><b>Plano:</b> ${planoAdquirido}</p>
      <p><b>ID da Transação:</b> ${pagamento.id}</p>
    `;
    
    await apiInstance.sendTransacEmail(emailParaVoce);

    // 2. Envia e-mail de confirmação para o comprador
    let emailParaCliente = new SibApiV3Sdk.SendSmtpEmail();
    emailParaCliente.sender = { email: meuEmail };
    emailParaCliente.to = [{ email: emailComprador }];
    emailParaCliente.subject = `Confirmação de Compra - ${planoAdquirido}`;
    emailParaCliente.htmlContent = `
      <p>Olá ${nomeComprador},</p>
      <p>Parabéns pela sua compra do plano <b>${planoAdquirido}</b>!</p>
      <p>Seu acesso será criado em breve. Qualquer dúvida, entre em contato.</p>
      <p>Obrigado!</p>
    `;

    await apiInstance.sendTransacEmail(emailParaCliente);

    response.status(200).send('E-mails enviados com sucesso!');

  } catch (error) {
    console.error('Erro no processamento da notificação:', error.response?.data || error.message);
    response.status(500).send('Erro interno do servidor.');
  }
}
