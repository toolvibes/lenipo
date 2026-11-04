from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.legal_links import LegalLinks
from ...models.legal_links_input import LegalLinksInput
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: LegalLinksInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/admin/legal-links",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> LegalLinks | Problem:
    if response.status_code == 200:
        response_200 = LegalLinks.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[LegalLinks | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: LegalLinksInput,

) -> Response[LegalLinks | Problem]:
    """ Set the links to imprint and privacy policy

     null removes an own link; the default from the environment applies again.

    Requires the global permission `admin`.

    Args:
        body (LegalLinksInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[LegalLinks | Problem]
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
    body: LegalLinksInput,

) -> LegalLinks | Problem | None:
    """ Set the links to imprint and privacy policy

     null removes an own link; the default from the environment applies again.

    Requires the global permission `admin`.

    Args:
        body (LegalLinksInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        LegalLinks | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: LegalLinksInput,

) -> Response[LegalLinks | Problem]:
    """ Set the links to imprint and privacy policy

     null removes an own link; the default from the environment applies again.

    Requires the global permission `admin`.

    Args:
        body (LegalLinksInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[LegalLinks | Problem]
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
    body: LegalLinksInput,

) -> LegalLinks | Problem | None:
    """ Set the links to imprint and privacy policy

     null removes an own link; the default from the environment applies again.

    Requires the global permission `admin`.

    Args:
        body (LegalLinksInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        LegalLinks | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
