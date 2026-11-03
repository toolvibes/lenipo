from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.custom_field import CustomField
from ...models.problem import Problem
from ...models.update_custom_field_request import UpdateCustomFieldRequest
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: UpdateCustomFieldRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/api/v1/admin/custom-fields/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CustomField | Problem:
    if response.status_code == 200:
        response_200 = CustomField.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CustomField | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCustomFieldRequest,

) -> Response[CustomField | Problem]:
    """ Change, archive or restore a custom field

     Options are given as the full list; entries with an id are renamed or archived, entries without one
    are added, missing ones are archived.

    Requires the global permission `admin`.

    Args:
        id (str):
        body (UpdateCustomFieldRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CustomField | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCustomFieldRequest,

) -> CustomField | Problem | None:
    """ Change, archive or restore a custom field

     Options are given as the full list; entries with an id are renamed or archived, entries without one
    are added, missing ones are archived.

    Requires the global permission `admin`.

    Args:
        id (str):
        body (UpdateCustomFieldRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CustomField | Problem
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCustomFieldRequest,

) -> Response[CustomField | Problem]:
    """ Change, archive or restore a custom field

     Options are given as the full list; entries with an id are renamed or archived, entries without one
    are added, missing ones are archived.

    Requires the global permission `admin`.

    Args:
        id (str):
        body (UpdateCustomFieldRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CustomField | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateCustomFieldRequest,

) -> CustomField | Problem | None:
    """ Change, archive or restore a custom field

     Options are given as the full list; entries with an id are renamed or archived, entries without one
    are added, missing ones are archived.

    Requires the global permission `admin`.

    Args:
        id (str):
        body (UpdateCustomFieldRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CustomField | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
