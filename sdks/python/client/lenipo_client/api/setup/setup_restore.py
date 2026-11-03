from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.restore_result import RestoreResult
from ...models.setup_restore_body import SetupRestoreBody
from typing import cast



def _get_kwargs(
    *,
    body: SetupRestoreBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/setup/restore",
    }

    _kwargs["files"] = body.to_multipart()

    headers["Content-Type"] = "multipart/form-data; boundary=+++"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | RestoreResult:
    if response.status_code == 200:
        response_200 = RestoreResult.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | RestoreResult]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetupRestoreBody,

) -> Response[Problem | RestoreResult]:
    """ Restore a backup into this fresh instance

     Only while setup is still required, with the setup code in the X-Setup-Code header. The ZIP (field
    "file") must come from the same Lenipo version. Afterwards people sign in with their accounts from
    the backup.

    Args:
        body (SetupRestoreBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | RestoreResult]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SetupRestoreBody,

) -> Problem | RestoreResult | None:
    """ Restore a backup into this fresh instance

     Only while setup is still required, with the setup code in the X-Setup-Code header. The ZIP (field
    "file") must come from the same Lenipo version. Afterwards people sign in with their accounts from
    the backup.

    Args:
        body (SetupRestoreBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | RestoreResult
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetupRestoreBody,

) -> Response[Problem | RestoreResult]:
    """ Restore a backup into this fresh instance

     Only while setup is still required, with the setup code in the X-Setup-Code header. The ZIP (field
    "file") must come from the same Lenipo version. Afterwards people sign in with their accounts from
    the backup.

    Args:
        body (SetupRestoreBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | RestoreResult]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SetupRestoreBody,

) -> Problem | RestoreResult | None:
    """ Restore a backup into this fresh instance

     Only while setup is still required, with the setup code in the X-Setup-Code header. The ZIP (field
    "file") must come from the same Lenipo version. Afterwards people sign in with their accounts from
    the backup.

    Args:
        body (SetupRestoreBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | RestoreResult
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
