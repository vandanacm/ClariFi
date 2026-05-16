set docPath to POSIX file "/Users/vmansur/MyDrive/Spring'26/ECS273/ClariFi/reports/Team7_ClariFi_Proposal_Report.docx"
set pdfPath to POSIX file "/Users/vmansur/MyDrive/Spring'26/ECS273/ClariFi/reports/Team7_ClariFi_Proposal_Report_WordExport.pdf"

tell application "Microsoft Word"
	activate
	open docPath
	set activeDoc to active document
	save as activeDoc file name pdfPath file format format PDF
	close activeDoc saving no
end tell
