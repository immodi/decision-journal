package com.modi.decisionjournal.ui

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.modi.decisionjournal.R
import com.modi.decisionjournal.databinding.FragmentSignInBinding
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class SignInFragment : Fragment() {

    private var _binding: FragmentSignInBinding? = null
    private val binding get() = _binding!!

    private val auth = FirebaseAuth.getInstance()
    private val credentialManager by lazy { CredentialManager.create(requireContext()) }
    private var registering = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentSignInBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.modeSwitch.setOnClickListener {
            registering = !registering
            render()
        }
        binding.submitButton.setOnClickListener { submit() }

        binding.googleButton.isVisible = getString(R.string.google_web_client_id).isNotBlank()
        binding.googleButton.setOnClickListener { googleSignIn() }

        render()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun render() {
        binding.submitButton.setText(if (registering) R.string.create_account else R.string.sign_in)
        binding.modeSwitch.setText(if (registering) R.string.have_account else R.string.new_here)
        binding.errorText.visibility = View.GONE
        binding.errorText.text = null
    }

    private fun submit() {
        val email = binding.emailInput.text?.toString()?.trim().orEmpty()
        val password = binding.passwordInput.text?.toString().orEmpty()
        if (email.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.email_and_password_required))
            return
        }

        setBusy(true)
        val task = if (registering) {
            auth.createUserWithEmailAndPassword(email, password)
        } else {
            auth.signInWithEmailAndPassword(email, password)
        }

        task.addOnCompleteListener { result ->
            if (!isAdded) return@addOnCompleteListener
            setBusy(false)
            if (!result.isSuccessful) {
                Log.e(javaClass.simpleName, "Email sign-in failed", result.exception)
                showError(getString(R.string.sign_in_failed))
            }
            // Success is handled by MainActivity's auth-state listener.
        }
    }

    private fun googleSignIn() {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .setServerClientId(getString(R.string.google_web_client_id))
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        setBusy(true)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val response = credentialManager.getCredential(
                    context = requireActivity(),
                    request = request,
                )
                val credential = response.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
                    auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await()
                    // MainActivity's auth listener swaps the screen on success.
                } else {
                    showError(getString(R.string.google_sign_in_failed))
                }
            } catch (_: GetCredentialCancellationException) {
                // The account picker was dismissed; nothing to report.
            } catch (error: GetCredentialException) {
                Log.e(javaClass.simpleName, "Google sign-in failed", error)
                showError(getString(R.string.google_sign_in_failed))
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Google sign-in failed", error)
                showError(getString(R.string.google_sign_in_failed))
            } finally {
                if (_binding != null) setBusy(false)
            }
        }
    }

    private fun setBusy(busy: Boolean) {
        binding.progress.visibility = if (busy) View.VISIBLE else View.GONE
        binding.submitButton.isEnabled = !busy
        binding.modeSwitch.isEnabled = !busy
        binding.googleButton.isEnabled = !busy
    }

    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
}
