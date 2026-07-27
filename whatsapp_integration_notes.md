# Requisitos oficiais para integração com WhatsApp

A integração do sistema deve utilizar exclusivamente a **WhatsApp Business Platform / Meta Cloud API**. Confirmações e lembretes de agendamento são um caso de uso de notificações da plataforma.

Para mensagens iniciadas pela empresa fora da janela de atendimento de 24 horas, a Meta exige um **modelo de mensagem aprovado**. A confirmação imediata e os lembretes de 24 horas e do dia do atendimento devem ser configurados como modelos de utilidade, com variáveis correspondentes aos dados do agendamento. A cliente deverá consentir, no formulário, em receber comunicações pelo WhatsApp, e poderá revogar esse consentimento.

O número que atualmente usa o WhatsApp Messenger pessoal não pode ser conectado diretamente à Cloud API sem excluir a conta. Para preservar o número, a proprietária deverá migrá-lo primeiro para o aplicativo WhatsApp Business e usar um parceiro habilitado para o fluxo de coexistência; alternativamente, poderá cadastrar um novo número comercial para a Cloud API. A ativação da API exige uma conta comercial do WhatsApp (WABA), uma conta no Gerenciador de Negócios da Meta e credenciais mantidas somente no servidor.

## Fontes oficiais

1. Plataforma do WhatsApp Business: https://whatsappbusiness.com/pt-br/products/business-platform/
2. Política de Mensagens do WhatsApp Business: https://whatsappbusiness.com/pt-br/policy/
3. Termos da Meta para o WhatsApp Business: https://www.whatsapp.com/legal/meta-terms-whatsapp-business?lang=pt
4. Modelos de mensagem da Meta: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
5. Uso do app WhatsApp Business junto à Cloud API: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
6. Migração de um número existente para uma conta comercial: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/migrate-existing-whatsapp-number-to-a-business-account/
