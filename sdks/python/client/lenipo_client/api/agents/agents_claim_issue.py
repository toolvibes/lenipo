from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.claim import Claim
from ...models.claim_request import ClaimRequest
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: ClaimRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues/{key}/claim".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Claim | Problem:
    if response.status_code == 200:
        response_200 = Claim.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Claim | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimRequest,

) -> Response[Claim | Problem]:
    """ Claim an issue

     Atomic: makes the caller the assignee of an unassigned issue and holds it for 30 minutes; every
    heartbeat (`PUT /me/presence`) extends the claims. 409 when someone else is assigned or works on it,
    and with `claimConflicts` when branch or paths overlap with other claims in the project, unless
    `force` is set. Claiming again renews and changes the work area.

    Args:
        key (str):
        body (ClaimRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Claim | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimRequest,

) -> Claim | Problem | None:
    """ Claim an issue

     Atomic: makes the caller the assignee of an unassigned issue and holds it for 30 minutes; every
    heartbeat (`PUT /me/presence`) extends the claims. 409 when someone else is assigned or works on it,
    and with `claimConflicts` when branch or paths overlap with other claims in the project, unless
    `force` is set. Claiming again renews and changes the work area.

    Args:
        key (str):
        body (ClaimRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Claim | Problem
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimRequest,

) -> Response[Claim | Problem]:
    """ Claim an issue

     Atomic: makes the caller the assignee of an unassigned issue and holds it for 30 minutes; every
    heartbeat (`PUT /me/presence`) extends the claims. 409 when someone else is assigned or works on it,
    and with `claimConflicts` when branch or paths overlap with other claims in the project, unless
    `force` is set. Claiming again renews and changes the work area.

    Args:
        key (str):
        body (ClaimRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Claim | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimRequest,

) -> Claim | Problem | None:
    """ Claim an issue

     Atomic: makes the caller the assignee of an unassigned issue and holds it for 30 minutes; every
    heartbeat (`PUT /me/presence`) extends the claims. 409 when someone else is assigned or works on it,
    and with `claimConflicts` when branch or paths overlap with other claims in the project, unless
    `force` is set. Claiming again renews and changes the work area.

    Args:
        key (str):
        body (ClaimRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Claim | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
