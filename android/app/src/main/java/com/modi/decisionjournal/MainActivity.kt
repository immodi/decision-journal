package com.modi.decisionjournal

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import androidx.fragment.app.commit
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.modi.decisionjournal.data.Repositories
import com.modi.decisionjournal.databinding.ActivityMainBinding
import com.modi.decisionjournal.reminders.NotificationHelper
import com.modi.decisionjournal.reminders.ReminderScheduler
import com.modi.decisionjournal.ui.DetailFragment
import com.modi.decisionjournal.ui.HomeFragment
import com.modi.decisionjournal.ui.InsightsFragment
import com.modi.decisionjournal.ui.NewDecisionFragment
import com.modi.decisionjournal.ui.ReviewFragment
import com.modi.decisionjournal.ui.SettingsFragment
import com.modi.decisionjournal.ui.SignInFragment

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val auth = FirebaseAuth.getInstance()

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val authListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
        onAuthChanged(firebaseAuth.currentUser)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        NotificationHelper.ensureChannel(this)
        requestNotificationPermission()
        auth.addAuthStateListener(authListener)
    }

    override fun onDestroy() {
        auth.removeAuthStateListener(authListener)
        super.onDestroy()
    }

    private val currentFragment: Fragment?
        get() = supportFragmentManager.findFragmentById(R.id.container)

    private fun onAuthChanged(user: FirebaseUser?) {
        if (user == null) {
            ReminderScheduler.cancel(this)
            Repositories.clear()
            if (currentFragment !is SignInFragment) {
                replace(SignInFragment(), clearStack = true, addToBackStack = false)
            }
        } else {
            ReminderScheduler.schedule(this)
            if (currentFragment == null || currentFragment is SignInFragment) {
                replace(HomeFragment(), clearStack = true, addToBackStack = false)
            }
        }
    }

    fun openHome() = replace(HomeFragment(), clearStack = true, addToBackStack = false)

    fun openNewDecision() = replace(NewDecisionFragment.forCreate())

    fun openEditDecision(id: String) = replace(NewDecisionFragment.forEdit(id))

    fun openDetail(id: String) = replace(DetailFragment.forDecision(id))

    fun openReview(id: String) = replace(ReviewFragment.forDecision(id))

    fun openInsights() = replace(InsightsFragment())

    fun openSettings() = replace(SettingsFragment())

    /** Used after creating a decision: replace the form so Back does not return to it. */
    fun openDetailAfterCreate(id: String) {
        supportFragmentManager.popBackStack()
        replace(DetailFragment.forDecision(id), addToBackStack = true)
    }

    fun goBack() {
        supportFragmentManager.popBackStack()
    }

    private fun replace(
        fragment: Fragment,
        clearStack: Boolean = false,
        addToBackStack: Boolean = true,
    ) {
        if (clearStack) {
            supportFragmentManager.popBackStack(null, FragmentManager.POP_BACK_STACK_INCLUSIVE)
        }
        supportFragmentManager.commit {
            replace(R.id.container, fragment)
            if (addToBackStack) addToBackStack(fragment.javaClass.simpleName)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
