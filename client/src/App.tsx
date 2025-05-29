import React from 'react'
import { Router, Route, Switch } from 'wouter'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { AppProvider } from './context/AppContext'
import { AuthorizationProvider } from './context/AuthorizationContext'
import { Toaster } from './components/ui/toaster'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import PurchaseOrders from './pages/PurchaseOrders'
import Companies from './pages/Companies'
import Users from './pages/Users'
import Products from './pages/Products'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Keyuser from './pages/Keyuser'
import NotFound from './pages/not-found'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AuthorizationProvider>
          <AppProvider>
            <Router>
              <Switch>
                <Route path="/login" component={Login} />
                <Route path="/dev" component={Keyuser} />
                <Route path="/" nest>
                  <Layout>
                    <Switch>
                      <Route path="/" component={Dashboard} />
                      <Route path="/dashboard" component={Dashboard} />
                      <Route path="/orders" component={Orders} />
                      <Route path="/purchase-orders" component={PurchaseOrders} />
                      <Route path="/companies" component={Companies} />
                      <Route path="/users" component={Users} />
                      <Route path="/products" component={Products} />
                      <Route path="/logs" component={Logs} />
                      <Route path="/settings" component={Settings} />
                      <Route component={NotFound} />
                    </Switch>
                  </Layout>
                </Route>
              </Switch>
            </Router>
            <Toaster />
          </AppProvider>
        </AuthorizationProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App