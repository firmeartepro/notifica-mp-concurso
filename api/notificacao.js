const axios = require('axios');

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).send('Método não permitido');
    return;
  }

  const { data } = request.body;

  if (!data || !data.id) {
    response.status(400).send('Dados de notificação inválidos.');
    return;
  }

  try {
    // 1. Consulta o Mercado Pago para obter os detalhes completos da transação
    const url = `https://api.mercadopago.com/v1/payments/${data.id}`;
    const headers = {
      'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
    };
    
    const mpResponse = await axios.get(url, { headers });
    const pagamento = mpResponse.data;

    // 2. Verifica se o pagamento foi aprovado
    if (pagamento.status !== 'approved') {
      response.status(200).send('Pagamento não aprovado. Nenhuma ação será tomada.');
      return;
    }
    
    // 3. Extrai as informações necessárias
    const nomeComprador = `${pagamento.payer.first_name} ${pagament.payer.last_name}`;
    const emailComprador = pagamento.payer.email;
    const planoAdquirido = pagamento.additional_info.items[0].title;
    
    // 4. Envia o e-mail de notificação (para você e para o comprador) usando a Brevo
    // A Brevo não tem uma biblioteca oficial para Serverless Functions.
    // Vamos usar a API diretamente com o Axios.

    const urlBrevo = 'https://api.brevo.com/v3/smtp/email';
    const headersBrevo = {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    };

    // E-mail para você
    const dadosEmailVoce = {
      sender: { email: 'concursoturboia@gmail.com', name: 'Moises Firme' },
      to: [{ email: 'concursoturboia@gmail.com' }],
      subject: `Nova Venda de Preparatório - ${planoAdquirido}`,
      htmlContent: `
        <p>Olá, uma nova venda foi realizada com sucesso!</p>
        <p><b>Nome do Comprador:</b> ${nomeComprador}</p>
        <p><b>E-mail:</b> ${emailComprador}</p>
        <p><b>Plano:</b> ${planoAdquirido}</p>
        <p><b>ID da Transação:</b> ${pagamento.id}</p>
      `
    };
    
    await axios.post(urlBrevo, dadosEmailVoce, { headers: headersBrevo });

    // E-mail para o comprador
    const dadosEmailCliente = {
      sender: { email: 'concursoturboia@gmail.com', name: 'Moises Firme' },
      to: [{ email: emailComprador }],
      subject: `Confirmação de Compra - ${planoAdquirido}`,
      htmlContent: `
        <p>Olá ${nomeComprador},</p>
        <p>Parabéns pela sua compra do plano <b>${planoAdquirido}</b>!</p>
        <p>Seu acesso será criado em breve. Qualquer dúvida, entre em contato.</p>
        <p>Obrigado!</p>
      `
    };
    
    await axios.post(urlBrevo, dadosEmailCliente, { headers: headersBrevo });

    response.status(200).send('E-mails enviados com sucesso!');

  } catch (error) {
    console.error(error);
    response.status(500).send('Erro ao processar a notificação.');
  }
}
