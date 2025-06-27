
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Receipt, Clock, CreditCard, FileText, Smartphone } from "lucide-react";

interface LandingPageProps {
  onSignUp: () => void;
  onDemo: () => void;
}

export const LandingPage = ({ onSignUp, onDemo }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-100">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Smart Invoice</h1>
          </div>
          <Button
            variant="outline"
            onClick={onSignUp}
            className="hidden sm:flex"
          >
            Log In
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 sm:py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-5xl font-bold text-black mb-6 leading-tight">
              Get Paid Like a Pro —<br />
              Even If You're Just Wrenching<br />
              in the Backyard
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Built for tuners, welders, detailers, and every blue-collar side hustler 
              that gets paid cash, Venmo, or not at all.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={onSignUp}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold"
                size="lg"
              >
                Start Invoicing Now (It's Free)
              </Button>
              
              <Button
                onClick={onDemo}
                variant="outline"
                className="w-full sm:w-auto px-8 py-4 text-lg"
                size="lg"
              >
                Preview in Demo Mode
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-black mb-8">
              Everything you need to get paid faster
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">Create in 60 Seconds</h3>
                  <p className="text-gray-600 text-sm">
                    Generate professional invoices faster than you can change your oil
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">Send by Text or Email</h3>
                  <p className="text-gray-600 text-sm">
                    Get your invoice to customers however they prefer to receive it
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">Accept Stripe Payments</h3>
                  <p className="text-gray-600 text-sm">
                    Get paid instantly with credit cards, no cash counting required
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">Track Jobs & Receipts</h3>
                  <p className="text-gray-600 text-sm">
                    Keep your business organized without the paperwork headache
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">No App Download</h3>
                  <p className="text-gray-600 text-sm">
                    Works in any browser on your phone, tablet, or computer
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">No BS</h3>
                  <p className="text-gray-600 text-sm">
                    Simple, straightforward invoicing that just works
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-black mb-6">
              Ready to get paid like a pro?
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={onSignUp}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold"
                size="lg"
              >
                Start Invoicing Now (It's Free)
              </Button>
              
              <Button
                onClick={onDemo}
                variant="outline"
                className="w-full sm:w-auto px-8 py-4 text-lg"
                size="lg"
              >
                Try Demo Mode
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-8">
        <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
          <p>&copy; 2024 Smart Invoice. Built for the hardworking folks who keep things running.</p>
        </div>
      </footer>
    </div>
  );
};
