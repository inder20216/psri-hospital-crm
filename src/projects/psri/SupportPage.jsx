import SupportBot from './SupportBot';

/**
 * Support.
 *
 * The page is the assistant and nothing else. The guides and reference notes it
 * answers with live in supportContent.js, which is the single copy of that
 * wording — so there is no second, on-screen version of it to fall out of step
 * with what the bot says.
 */
export default function SupportPage() {
  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">Support</h1>
          <p className="psri-subtitle">
            Ask anything about the CRM — how to do a job, or what something means.
          </p>
        </div>
      </div>

      <SupportBot />
    </div>
  );
}
