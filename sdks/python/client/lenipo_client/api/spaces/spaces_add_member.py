from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.add_space_member_request_type_0 import AddSpaceMemberRequestType0
from ...models.add_space_member_request_type_1 import AddSpaceMemberRequestType1
from ...models.problem import Problem
from ...models.space_member import SpaceMember
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/spaces/{key}/members".format(key=quote(str(key), safe=""),),
    }

    
    if isinstance(body, AddSpaceMemberRequestType0):
        _kwargs["json"] = body.to_dict()
    else:
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[SpaceMember]:
    if response.status_code == 201:
        response_201 = []
        _response_201 = response.json()
        for response_201_item_data in (_response_201):
            response_201_item = SpaceMember.from_dict(response_201_item_data)



            response_201.append(response_201_item)

        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[SpaceMember]]:
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
    body: AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1,

) -> Response[Problem | list[SpaceMember]]:
    """ Give a user or group a role in a space

    Args:
        key (str):
        body (AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[SpaceMember]]
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
    body: AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1,

) -> Problem | list[SpaceMember] | None:
    """ Give a user or group a role in a space

    Args:
        key (str):
        body (AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[SpaceMember]
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
    body: AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1,

) -> Response[Problem | list[SpaceMember]]:
    """ Give a user or group a role in a space

    Args:
        key (str):
        body (AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[SpaceMember]]
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
    body: AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1,

) -> Problem | list[SpaceMember] | None:
    """ Give a user or group a role in a space

    Args:
        key (str):
        body (AddSpaceMemberRequestType0 | AddSpaceMemberRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[SpaceMember]
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
