from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.bulk_create_request import BulkCreateRequest
from ...models.bulk_items_result import BulkItemsResult
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: BulkCreateRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues/bulk-create",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> BulkItemsResult | Problem:
    if response.status_code == 200:
        response_200 = BulkItemsResult.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[BulkItemsResult | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: BulkCreateRequest,

) -> Response[BulkItemsResult | Problem]:
    """ Create up to 100 issues

     Each issue goes through the same checks as POST /issues. The result has one line per issue in the
    order sent. With "atomic": true they are created in one transaction: all or none.

    Args:
        body (BulkCreateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BulkItemsResult | Problem]
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
    body: BulkCreateRequest,

) -> BulkItemsResult | Problem | None:
    """ Create up to 100 issues

     Each issue goes through the same checks as POST /issues. The result has one line per issue in the
    order sent. With "atomic": true they are created in one transaction: all or none.

    Args:
        body (BulkCreateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BulkItemsResult | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: BulkCreateRequest,

) -> Response[BulkItemsResult | Problem]:
    """ Create up to 100 issues

     Each issue goes through the same checks as POST /issues. The result has one line per issue in the
    order sent. With "atomic": true they are created in one transaction: all or none.

    Args:
        body (BulkCreateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BulkItemsResult | Problem]
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
    body: BulkCreateRequest,

) -> BulkItemsResult | Problem | None:
    """ Create up to 100 issues

     Each issue goes through the same checks as POST /issues. The result has one line per issue in the
    order sent. With "atomic": true they are created in one transaction: all or none.

    Args:
        body (BulkCreateRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BulkItemsResult | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
