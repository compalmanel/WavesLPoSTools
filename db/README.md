# Download the Latest Database

You can download and manually deploy the latest database rather than synchronizing all Waves blockchain which takes some time nowadays.

To download and manually deploy the latest blockchain database, complete the following steps:

1. Download the **blocks.tar** archive containing the latest database from the links below.

    Last: [**blocks.tar**](https://github.com/cryptolopes/WavesLPoSTools/raw/db/db/blocks.tar)

    The approximate size of the latest database is 194 Mb (in September 2020).

2. Run the checksum with some tool to test files (checksum of the blocks.tar file should be the same as inside blocks.tar.SHA256SUM file).

3. Unpack the database into the root of WavesLPoSTools.

    ```bash
    tar -xf blocks.tar
    ```

    **Alternative downloading and unpacking method**
    
    Navigate to the root of WavesLPoSTools and run the following command:

    ```bash
    wget -qO- https://github.com/cryptolopes/WavesLPoSTools/raw/db/db/blocks.tar --show-progress | tar xfz -
    ```
